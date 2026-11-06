
const crypto = require("crypto");
const { getClient } = require("../database/client");

const db = getClient();

const TICKET_STATUSES = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING_USER: "WAITING_USER",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
};

const SENDER_TYPES = {
  USER: "USER",
  ADMIN: "ADMIN",
  SYSTEM: "SYSTEM",
};

function generateTicketCode() {
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `ZK-${random}`;
}

async function createTicket({
  userId,
  category = "OTHER",
  priority = "NORMAL",
  subject = null,
  message,
  metadata = null,
}) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const normalizedMessage = String(message || "").trim();

  if (!normalizedMessage) {
    throw new Error("Ticket message is required");
  }

  const client = await db.connect();

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await client.query("BEGIN");

      try {
        const ticketCode = generateTicketCode();

        const ticketResult = await client.query(
          `
            INSERT INTO support_tickets (
              user_id,
              ticket_id,
              category,
              priority,
              status,
              subject,
              last_message_at,
              metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
            RETURNING *
          `,
          [
            userId,
            ticketCode,
            String(category).toUpperCase(),
            String(priority).toUpperCase(),
            TICKET_STATUSES.OPEN,
            subject ? String(subject).trim().slice(0, 200) : null,
            metadata,
          ]
        );

        const ticket = ticketResult.rows[0];

        await client.query(
          `
            INSERT INTO support_messages (
              ticket_id,
              sender_user_id,
              sender_type,
              message_type,
              message,
              metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            ticket.id,
            userId,
            SENDER_TYPES.USER,
            "TEXT",
            normalizedMessage,
            null,
          ]
        );

        await client.query("COMMIT");

        return ticket;
      } catch (error) {
        await client.query("ROLLBACK");

        if (error.code === "23505" && attempt < 4) {
          continue;
        }

        throw error;
      }
    }

    throw new Error("Could not generate a unique ticket ID");
  } finally {
    client.release();
  }
}

async function findTicketById(id) {
  if (!id) return null;

  const result = await db.query(
    `
      SELECT
        t.*,
        u.telegram_user_id,
        u.username,
        u.display_name
      FROM support_tickets t
      JOIN users u ON u.id = t.user_id
      WHERE t.id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findTicketByCode(ticketCode) {
  if (!ticketCode) return null;

  const result = await db.query(
    `
      SELECT
        t.*,
        u.telegram_user_id,
        u.username,
        u.display_name
      FROM support_tickets t
      JOIN users u ON u.id = t.user_id
      WHERE UPPER(t.ticket_id) = UPPER($1)
      LIMIT 1
    `,
    [String(ticketCode).trim()]
  );

  return result.rows[0] || null;
}

async function findOpenTicketByUserId(userId) {
  if (!userId) return null;

  const result = await db.query(
    `
      SELECT *
      FROM support_tickets
      WHERE user_id = $1
        AND status IN ('OPEN', 'IN_PROGRESS', 'WAITING_USER')
      ORDER BY
        last_message_at DESC NULLS LAST,
        created_at DESC
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function getUserTickets(
  userId,
  {
    limit = 10,
    offset = 0,
  } = {}
) {
  if (!userId) return [];

  const result = await db.query(
    `
      SELECT
        t.*,
        (
          SELECT COUNT(*)::INTEGER
          FROM support_messages m
          WHERE m.ticket_id = t.id
        ) AS message_count
      FROM support_tickets t
      WHERE t.user_id = $1
      ORDER BY
        t.last_message_at DESC NULLS LAST,
        t.created_at DESC
      LIMIT $2
      OFFSET $3
    `,
    [
      userId,
      Math.max(1, Math.min(Number(limit) || 10, 100)),
      Math.max(0, Number(offset) || 0),
    ]
  );

  return result.rows;
}

async function listTickets({
  status = null,
  category = null,
  priority = null,
  assignedTo = null,
  userId = null,
  limit = 20,
  offset = 0,
} = {}) {
  const conditions = [];
  const values = [];

  function addCondition(sql, value) {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  }

  if (status) {
    addCondition("t.status = ?", String(status).toUpperCase());
  }

  if (category) {
    addCondition("t.category = ?", String(category).toUpperCase());
  }

  if (priority) {
    addCondition("t.priority = ?", String(priority).toUpperCase());
  }

  if (assignedTo) {
    addCondition("t.assigned_to = ?", assignedTo);
  }

  if (userId) {
    addCondition("t.user_id = ?", userId);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  values.push(Math.max(1, Math.min(Number(limit) || 20, 100)));
  const limitParam = `$${values.length}`;

  values.push(Math.max(0, Number(offset) || 0));
  const offsetParam = `$${values.length}`;

  const result = await db.query(
    `
      SELECT
        t.*,
        u.telegram_user_id,
        u.username,
        u.display_name,
        (
          SELECT COUNT(*)::INTEGER
          FROM support_messages m
          WHERE m.ticket_id = t.id
        ) AS message_count
      FROM support_tickets t
      JOIN users u ON u.id = t.user_id
      ${whereClause}
      ORDER BY
        CASE t.status
          WHEN 'OPEN' THEN 1
          WHEN 'IN_PROGRESS' THEN 2
          WHEN 'WAITING_USER' THEN 3
          WHEN 'RESOLVED' THEN 4
          WHEN 'CLOSED' THEN 5
          ELSE 6
        END,
        t.last_message_at DESC NULLS LAST,
        t.created_at DESC
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `,
    values
  );

  return result.rows;
}

async function countTickets({
  status = null,
  category = null,
} = {}) {
  const conditions = [];
  const values = [];

  if (status) {
    values.push(String(status).toUpperCase());
    conditions.push(`status = $${values.length}`);
  }

  if (category) {
    values.push(String(category).toUpperCase());
    conditions.push(`category = $${values.length}`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await db.query(
    `
      SELECT COUNT(*)::INTEGER AS total
      FROM support_tickets
      ${whereClause}
    `,
    values
  );

  return result.rows[0]?.total || 0;
}

async function getTicketStats() {
  const result = await db.query(
    `
      SELECT
        COUNT(*)::INTEGER AS total,
        COUNT(*) FILTER (
          WHERE status = 'OPEN'
        )::INTEGER AS open,
        COUNT(*) FILTER (
          WHERE status = 'IN_PROGRESS'
        )::INTEGER AS in_progress,
        COUNT(*) FILTER (
          WHERE status = 'WAITING_USER'
        )::INTEGER AS waiting_user,
        COUNT(*) FILTER (
          WHERE status = 'RESOLVED'
        )::INTEGER AS resolved,
        COUNT(*) FILTER (
          WHERE status = 'CLOSED'
        )::INTEGER AS closed
      FROM support_tickets
    `
  );

  return result.rows[0];
}

async function addMessage({
  ticketId,
  senderUserId = null,
  senderType = SENDER_TYPES.USER,
  message,
  messageType = "TEXT",
  metadata = null,
}) {
  if (!ticketId) {
    throw new Error("Ticket ID is required");
  }

  const normalizedMessage = String(message || "").trim();

  if (!normalizedMessage) {
    throw new Error("Message is required");
  }

  const normalizedSenderType = String(senderType).toUpperCase();

  if (!Object.values(SENDER_TYPES).includes(normalizedSenderType)) {
    throw new Error("Invalid sender type");
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        INSERT INTO support_messages (
          ticket_id,
          sender_user_id,
          sender_type,
          message_type,
          message,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        ticketId,
        senderUserId,
        normalizedSenderType,
        String(messageType).toUpperCase(),
        normalizedMessage,
        metadata,
      ]
    );

    const ticketResult = await client.query(
      `
        UPDATE support_tickets
        SET
          last_message_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [ticketId]
    );

    if (!ticketResult.rowCount) {
      throw new Error("Ticket not found");
    }

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getTicketMessages(
  ticketId,
  {
    limit = 100,
    offset = 0,
  } = {}
) {
  if (!ticketId) return [];

  const result = await db.query(
    `
      SELECT
        m.*,
        u.telegram_user_id,
        u.username,
        u.display_name
      FROM support_messages m
      LEFT JOIN users u ON u.id = m.sender_user_id
      WHERE m.ticket_id = $1
      ORDER BY m.created_at ASC, m.id ASC
      LIMIT $2
      OFFSET $3
    `,
    [
      ticketId,
      Math.max(1, Math.min(Number(limit) || 100, 500)),
      Math.max(0, Number(offset) || 0),
    ]
  );

  return result.rows;
}

async function updateTicketStatus(ticketId, status) {
  if (!ticketId) {
    throw new Error("Ticket ID is required");
  }

  const normalizedStatus = String(status || "").toUpperCase();

  if (!Object.values(TICKET_STATUSES).includes(normalizedStatus)) {
    throw new Error("Invalid ticket status");
  }

  const result = await db.query(
    `
      UPDATE support_tickets
      SET
        status = $2,
        resolved_at = CASE
          WHEN $2 = 'RESOLVED' THEN NOW()
          WHEN $2 IN ('OPEN', 'IN_PROGRESS', 'WAITING_USER') THEN NULL
          ELSE resolved_at
        END,
        closed_at = CASE
          WHEN $2 = 'CLOSED' THEN NOW()
          WHEN $2 <> 'CLOSED' THEN NULL
          ELSE closed_at
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [ticketId, normalizedStatus]
  );

  return result.rows[0] || null;
}

async function assignTicket(ticketId, adminUserId) {
  if (!ticketId) {
    throw new Error("Ticket ID is required");
  }

  const result = await db.query(
    `
      UPDATE support_tickets
      SET
        assigned_to = $2,
        status = CASE
          WHEN status = 'OPEN' THEN 'IN_PROGRESS'
          ELSE status
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [ticketId, adminUserId || null]
  );

  return result.rows[0] || null;
}

async function deleteTicket(ticketId) {
  if (!ticketId) {
    throw new Error("Ticket ID is required");
  }

  const result = await db.query(
    `
      DELETE FROM support_tickets
      WHERE id = $1
      RETURNING *
    `,
    [ticketId]
  );

  return result.rows[0] || null;
}

async function deleteTicketByCode(ticketCode) {
  if (!ticketCode) {
    throw new Error("Ticket code is required");
  }

  const result = await db.query(
    `
      DELETE FROM support_tickets
      WHERE UPPER(ticket_id) = UPPER($1)
      RETURNING *
    `,
    [String(ticketCode).trim()]
  );

  return result.rows[0] || null;
}

module.exports = {
  TICKET_STATUSES,
  SENDER_TYPES,

  generateTicketCode,

  createTicket,
  findTicketById,
  findTicketByCode,
  findOpenTicketByUserId,

  getUserTickets,
  listTickets,
  countTickets,
  getTicketStats,

  addMessage,
  getTicketMessages,

  updateTicketStatus,
  assignTicket,

  deleteTicket,
  deleteTicketByCode,
};
