const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_rollout_metrics (
        rollout_id,
        metric_name,
        metric_value,
        recorded_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [
      data.rolloutId,
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
      FROM download_strategy_rollout_metrics
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByRolloutId(rolloutId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_metrics
      WHERE rollout_id = $1
      ORDER BY recorded_at DESC
      LIMIT $2
    `,
    [rolloutId, safeLimit]
  );

  return result.rows;
}

async function findByMetricName(rolloutId, metricName, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_metrics
      WHERE rollout_id = $1
        AND metric_name = $2
      ORDER BY recorded_at DESC
      LIMIT $3
    `,
    [rolloutId, metricName, safeLimit]
  );

  return result.rows;
}

async function findLatest(rolloutId, metricName) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_metrics
      WHERE rollout_id = $1
        AND metric_name = $2
      ORDER BY recorded_at DESC
      LIMIT 1
    `,
    [rolloutId, metricName]
  );

  return result.rows[0] || null;
}

module.exports = {
  create,
  findById,
  findByRolloutId,
  findByMetricName,
  findLatest,
};
