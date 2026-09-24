const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO credit_reservations (
        user_id,
        request_id,
        job_id,
        amount,
        status,
        expires_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      data.userId,
      data.requestId || null,
      data.jobId || null,
      data.amount,
      data.status || "RESERVED",
      data.expiresAt || null,
      data.metadata || null,
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
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at ASC
    `,
    [userId]
  );

  return result.rows;
}

async function updateStatus(id, status) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE credit_reservations
      SET status = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, status]
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
