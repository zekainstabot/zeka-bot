const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_rollout_daily_metrics (
        rollout_id,
        metric_date,
        total_requests,
        successful_requests,
        failed_requests,
        success_rate,
        failure_rate,
        average_latency_ms,
        total_downloads,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      data.rolloutId,
      data.metricDate,
      data.totalRequests ?? 0,
      data.successfulRequests ?? 0,
      data.failedRequests ?? 0,
      data.successRate ?? null,
      data.failureRate ?? null,
      data.averageLatencyMs ?? null,
      data.totalDownloads ?? 0,
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
      FROM download_strategy_rollout_daily_metrics
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByRolloutId(rolloutId, limit = 365) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 365, 1000));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_daily_metrics
      WHERE rollout_id = $1
      ORDER BY metric_date DESC
      LIMIT $2
    `,
    [rolloutId, safeLimit]
  );

  return result.rows;
}

async function findByDate(rolloutId, metricDate) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_daily_metrics
      WHERE rollout_id = $1
        AND metric_date = $2
      LIMIT 1
    `,
    [rolloutId, metricDate]
  );

  return result.rows[0] || null;
}

async function findByDateRange(
  rolloutId,
  fromDate,
  toDate,
  limit = 1000
) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 1000, 2000));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_daily_metrics
      WHERE rollout_id = $1
        AND metric_date >= $2
        AND metric_date <= $3
      ORDER BY metric_date DESC
      LIMIT $4
    `,
    [rolloutId, fromDate, toDate, safeLimit]
  );

  return result.rows;
}

async function update(rolloutId, metricDate, updates) {
  const db = getClient();

  const allowedFields = [
    "total_requests",
    "successful_requests",
    "failed_requests",
    "success_rate",
    "failure_rate",
    "average_latency_ms",
    "total_downloads",
    "metadata",
  ];

  const entries = Object.entries(updates).filter(([field]) =>
    allowedFields.includes(field)
  );

  if (entries.length === 0) {
    return findByDate(rolloutId, metricDate);
  }

  const values = entries.map(([, value]) => value);

  const setClause = entries
    .map(([field], index) => `${field} = $${index + 3}`)
    .join(", ");

  const result = await db.query(
    `
      UPDATE download_strategy_rollout_daily_metrics
      SET ${setClause},
          updated_at = NOW()
      WHERE rollout_id = $1
        AND metric_date = $2
      RETURNING *
    `,
    [rolloutId, metricDate, ...values]
  );

  return result.rows[0] || null;
}

async function deleteByRolloutId(rolloutId) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM download_strategy_rollout_daily_metrics
      WHERE rollout_id = $1
    `,
    [rolloutId]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findByRolloutId,
  findByDate,
  findByDateRange,
  update,
  deleteByRolloutId,
};
