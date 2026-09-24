const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO dead_letter_queue (
        job_id,
        request_id,
        user_id,
        error_code,
        error_message,
        retry_count,
        status,
        retry_after,
        expires_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      data.jobId,
      data.requestId || null,
      data.userId || null,
      data.errorCode || null,
      data.errorMessage || null,
      data.retryCount ?? 0,
      data.status || "OPEN",
      data.retryAfter || null,
      data.expiresAt,
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
      FROM dead_letter_queue
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByJobId(jobId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM dead_letter_queue
      WHERE job_id = $1
      ORDER BY first_failed_at DESC
    `,
    [jobId]
  );

  return result.rows;
}

async function findOpen(limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM dead_letter_queue
      WHERE status = 'OPEN'
      ORDER BY first_failed_at ASC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function findRetryable(limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM dead_letter_queue
      WHERE status = 'OPEN'
        AND (retry_after IS NULL OR retry_after <= NOW())
        AND expires_at > NOW()
      ORDER BY retry_after ASC NULLS FIRST, first_failed_at ASC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function incrementRetry(id, retryAfter = null) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE dead_letter_queue
      SET
        retry_count = retry_count + 1,
        last_failed_at = NOW(),
        retry_after = $2
      WHERE id = $1
      RETURNING *
    `,
    [id, retryAfter]
  );

  return result.rows[0] || null;
}

async function resolve(id) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE dead_letter_queue
      SET
        status = 'RESOLVED',
        resolved_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function updateStatus(id, status) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE dead_letter_queue
      SET status = $2
      WHERE id = $1
      RETURNING *
    `,
    [id, status]
  );

  return result.rows[0] || null;
}

async function deleteById(id) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM dead_letter_queue
      WHERE id = $1
    `,
    [id]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findByJobId,
  findOpen,
  findRetryable,
  incrementRetry,
  resolve,
  updateStatus,
  deleteById,
};
