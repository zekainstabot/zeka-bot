const { getClient } = require("../database/client");

function getDb(client = null) {
  return client || getClient();
}

async function create(data, client = null) {
  const db = getDb(client);

  if (!data.userId) {
    throw new Error("User ID is required");
  }

  if (!data.creditAccountId) {
    throw new Error("Credit account ID is required");
  }

  if (!data.amount || data.amount <= 0) {
    throw new Error("Reservation amount must be greater than zero");
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
      VALUES ($1, $2, $3, $4, $5, 'RESERVED')
      RETURNING *
    `,
    [
      data.userId,
      data.creditAccountId,
      data.requestId || null,
      data.jobId || null,
      data.amount,
    ]
  );

  return result.rows[0];
}

async function findByJobId(jobId, client = null) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT *
      FROM credit_reservations
      WHERE job_id = $1
      ORDER BY id ASC
    `,
    [jobId]
  );

  return result.rows;
}

async function findActiveByJobId(jobId, client = null) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT *
      FROM credit_reservations
      WHERE job_id = $1
        AND status = 'RESERVED'
      ORDER BY id ASC
    `,
    [jobId]
  );

  return result.rows;
}

async function markConsumed(id, client = null) {
  const db = getDb(client);

  const result = await db.query(
    `
      UPDATE credit_reservations
      SET
        status = 'CONSUMED',
        consumed_at = NOW()
      WHERE id = $1
        AND status = 'RESERVED'
      RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function markReleased(id, client = null) {
  const db = getDb(client);

  const result = await db.query(
    `
      UPDATE credit_reservations
      SET
        status = 'RELEASED',
        released_at = NOW()
      WHERE id = $1
        AND status = 'RESERVED'
      RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}

module.exports = {
  create,
  findByJobId,
  findActiveByJobId,
  markConsumed,
  markReleased,
};
