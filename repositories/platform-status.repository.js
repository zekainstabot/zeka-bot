const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO platform_status (
        platform_id,
        status,
        reason,
        changed_by,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [
      data.platformId,
      data.status,
      data.reason || null,
      data.changedBy || null,
      data.metadata || null,
    ]
  );

  return result.rows[0];
}

async function findLatest(platformId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM platform_status
      WHERE platform_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [platformId]
  );

  return result.rows[0] || null;
}

async function findHistory(platformId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM platform_status
      WHERE platform_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [platformId, safeLimit]
  );

  return result.rows;
}

async function findByStatus(status, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM platform_status
      WHERE status = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [status, safeLimit]
  );

  return result.rows;
}

module.exports = {
  create,
  findLatest,
  findHistory,
  findByStatus,
};
