const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  if (!data.userId) {
    throw new Error("User ID is required");
  }

  if (!data.creditAccountId) {
    throw new Error("Credit account ID is required");
  }

  if (data.amount === undefined) {
    throw new Error("Reservation amount is required");
  }

  const result = await db.query(
    `
      INSERT INTO credit_reservations (
        user_id,
        credit_account_id,
        request_id,
        job_id,
        amount,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      data.userId,
      data.creditAccountId,
      data.requestId || null,
      data.jobId || null,
      data.amount,
      data.status || "RESERVED",
    ]
  );

  return result.rows[0];
}

async function findById(id) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM credit_reservations
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findActiveByUserId(userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM credit_reservations
      WHERE user_id = $1
        AND status = 'RESERVED'
      ORDER BY reserved_at ASC, created_at ASC
    `,
    [userId]
  );

  return result.rows;
}

async function updateStatus(id, status) {
  const db = getClient();

  let timestampColumn = null;

  if (status === "CONSUMED") {
    timestampColumn = "consumed_at";
  } else if (status === "RELEASED") {
    timestampColumn = "released_at";
  }

  const values = [id, status];

  let timestampSql = "";

  if (timestampColumn) {
    timestampSql = `, ${timestampColumn} = NOW()`;
  }

  const result = await db.query(
    `
      UPDATE credit_reservations
      SET status = $2
          ${timestampSql}
      WHERE id = $1
      RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}

async function release(id) {
  return updateStatus(id, "RELEASED");
}

async function consume(id) {
  return updateStatus(id, "CONSUMED");
}

async function expire(id) {
  return updateStatus(id, "EXPIRED");
}

module.exports = {
  create,
  findById,
  findActiveByUserId,
  updateStatus,
  release,
  consume,
  expire,
};
