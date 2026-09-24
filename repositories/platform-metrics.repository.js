const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO platform_metrics (
        platform_id,
        metric_name,
        metric_value,
        recorded_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [
      data.platformId,
      data.metricName,
      data.metricValue,
      data.recordedAt || new Date(),
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
      FROM platform_metrics
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
      FROM platform_metrics
      WHERE platform_id = $1
      ORDER BY recorded_at DESC
      LIMIT $2
    `,
    [platformId, safeLimit]
  );

  return result.rows;
}

async function findByMetricName(platformId, metricName, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM platform_metrics
      WHERE platform_id = $1
        AND metric_name = $2
      ORDER BY recorded_at DESC
      LIMIT $3
    `,
    [platformId, metricName, safeLimit]
  );

  return result.rows;
}

async function findLatest(platformId, metricName) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM platform_metrics
      WHERE platform_id = $1
        AND metric_name = $2
      ORDER BY recorded_at DESC
      LIMIT 1
    `,
    [platformId, metricName]
  );

  return result.rows[0] || null;
}

module.exports = {
  create,
  findById,
  findByPlatformId,
  findByMetricName,
  findLatest,
};
