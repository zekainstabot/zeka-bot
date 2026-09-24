const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO platform_errors (
        platform_id,
        error_type,
        error_code,
        error_message,
        request_id,
        job_id,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      data.platformId,
      data.errorType || "UNKNOWN",
      data.errorCode || null,
      data.errorMessage || null,
      data.requestId || null,
      data.jobId || null,
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
      FROM platform_errors
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByPlatformId(platformId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM platform_errors
      WHERE platform_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [platformId, safeLimit]
  );

  return result.rows;
}

async function findByErrorType(platformId, errorType, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM platform_errors
      WHERE platform_id = $1
        AND error_type = $2
      ORDER BY created_at DESC
      LIMIT $3
    `,
    [platformId, errorType, safeLimit]
  );

  return result.rows;
}

module.exports = {
  create,
  findById,
  findByPlatformId,
  findByErrorType,
};
