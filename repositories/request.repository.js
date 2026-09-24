const { getClient } = require("../database/client");

function generateRequestId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);

  return `${timestamp}${random}`.slice(0, 32);
}

async function create(data) {
  const db = getClient();

  const requestId = data.requestId || generateRequestId();

  const result = await db.query(
    `
      INSERT INTO requests (
        user_id,
        request_id,
        platform,
        request_type,
        status,
        original_url,
        normalized_url,
        estimated_cost,
        is_heavy
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      data.userId,
      requestId,
      data.platform || null,
      data.requestType || "DOWNLOAD",
      data.status || "WAITING",
      data.originalUrl || null,
      data.normalizedUrl || data.originalUrl || null,
      data.estimatedCost ?? null,
      data.isHeavy ?? false,
    ]
  );

  return result.rows[0];
}

async function findById(id) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM requests
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByRequestId(requestId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM requests
      WHERE request_id = $1
      LIMIT 1
    `,
    [requestId]
  );

  return result.rows[0] || null;
}

async function findByUserId(userId, limit = 50) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 50, 200)
  );

  const result = await db.query(
    `
      SELECT *
      FROM requests
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function updateStatus(id, status) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE requests
      SET status = $2
      WHERE id = $1
      RETURNING *
    `,
    [id, status]
  );

  return result.rows[0] || null;
}

async function update(id, updates) {
  const db = getClient();

  const allowedFields = [
    "platform",
    "request_type",
    "status",
    "original_url",
    "normalized_url",
    "estimated_cost",
    "final_cost",
    "is_heavy",
    "started_at",
    "completed_at",
    "cancelled_at",
    "error_code",
    "error_message",
  ];

  const entries = Object.entries(updates).filter(([field]) =>
    allowedFields.includes(field)
  );

  if (entries.length === 0) {
    return findById(id);
  }

  const values = entries.map(([, value]) => value);

  const setClause = entries
    .map(([field], index) => `${field} = $${index + 2}`)
    .join(", ");

  const result = await db.query(
    `
      UPDATE requests
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

module.exports = {
  create,
  findById,
  findByRequestId,
  findByUserId,
  updateStatus,
  update,
};
