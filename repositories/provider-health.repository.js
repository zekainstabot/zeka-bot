const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO provider_health (
        provider_name,
        platform_id,
        status,
        response_time_ms,
        success_rate,
        checked_at,
        error_message,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      data.providerName,
      data.platformId || null,
      data.status || "UNKNOWN",
      data.responseTimeMs ?? null,
      data.successRate ?? null,
      data.checkedAt || new Date(),
      data.errorMessage || null,
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
      FROM provider_health
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findLatestByProvider(providerName) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM provider_health
      WHERE provider_name = $1
      ORDER BY checked_at DESC
      LIMIT 1
    `,
    [providerName]
  );

  return result.rows[0] || null;
}

async function findByPlatformId(platformId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM provider_health
      WHERE platform_id = $1
      ORDER BY checked_at DESC
      LIMIT $2
    `,
    [platformId, safeLimit]
  );

  return result.rows;
}

async function findHistory(providerName, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM provider_health
      WHERE provider_name = $1
      ORDER BY checked_at DESC
      LIMIT $2
    `,
    [providerName, safeLimit]
  );

  return result.rows;
}

module.exports = {
  create,
  findById,
  findLatestByProvider,
  findByPlatformId,
  findHistory,
};
