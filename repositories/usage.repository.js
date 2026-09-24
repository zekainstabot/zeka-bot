const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO usage_records (
        user_id,
        request_id,
        job_id,
        platform,
        content_type,
        action_type,
        credit_amount,
        file_size_bytes,
        processing_time_ms,
        success,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `,
    [
      data.userId,
      data.requestId || null,
      data.jobId || null,
      data.platform || null,
      data.contentType || null,
      data.actionType,
      data.creditAmount ?? 0,
      data.fileSizeBytes ?? null,
      data.processingTimeMs ?? null,
      data.success ?? false,
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
      FROM usage_records
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByUserId(userId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM usage_records
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function findByRequestId(requestId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM usage_records
      WHERE request_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [requestId, safeLimit]
  );

  return result.rows;
}

async function findByJobId(jobId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM usage_records
      WHERE job_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [jobId, safeLimit]
  );

  return result.rows;
}

async function findByPlatform(platform, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM usage_records
      WHERE platform = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [platform, safeLimit]
  );

  return result.rows;
}

async function findByActionType(actionType, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM usage_records
      WHERE action_type = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [actionType, safeLimit]
  );

  return result.rows;
}

async function findSuccessful(userId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM usage_records
      WHERE user_id = $1
        AND success = TRUE
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function findFailed(userId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM usage_records
      WHERE user_id = $1
        AND success = FALSE
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function getUserStats(userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        COUNT(*)::BIGINT AS total_count,
        COUNT(*) FILTER (WHERE success = TRUE)::BIGINT AS success_count,
        COUNT(*) FILTER (WHERE success = FALSE)::BIGINT AS failed_count,
        COALESCE(SUM(credit_amount), 0) AS total_credit_amount,
        COALESCE(SUM(file_size_bytes), 0)::BIGINT AS total_file_size_bytes,
        COALESCE(AVG(processing_time_ms), 0) AS average_processing_time_ms
      FROM usage_records
      WHERE user_id = $1
    `,
    [userId]
  );

  return result.rows[0];
}

async function deleteById(id) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM usage_records
      WHERE id = $1
    `,
    [id]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findByUserId,
  findByRequestId,
  findByJobId,
  findByPlatform,
  findByActionType,
  findSuccessful,
  findFailed,
  getUserStats,
  deleteById,
};
