const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_rollout_latency_metrics (
        rollout_id,
        latency_bucket,
        period_start,
        period_end,
        total_requests,
        successful_requests,
        failed_requests,
        success_rate,
        failure_rate,
        average_latency_ms,
        total_downloads,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `,
    [
      data.rolloutId,
      data.latencyBucket,
      data.periodStart,
      data.periodEnd,
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
      FROM download_strategy_rollout_latency_metrics
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
      FROM download_strategy_rollout_latency_metrics
      WHERE rollout_id = $1
      ORDER BY period_start DESC
      LIMIT $2
    `,
    [rolloutId, safeLimit]
  );

  return result.rows;
}

async function findByLatencyBucket(latencyBucket, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_latency_metrics
      WHERE latency_bucket = $1
      ORDER BY period_start DESC
      LIMIT $2
    `,
    [latencyBucket, safeLimit]
  );

  return result.rows;
}

async function findByLatencyAndPeriod(
  rolloutId,
  latencyBucket,
  periodStart
) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_latency_metrics
      WHERE rollout_id = $1
        AND latency_bucket = $2
        AND period_start = $3
      LIMIT 1
    `,
    [rolloutId, latencyBucket, periodStart]
  );

  return result.rows[0] || null;
}

async function findByDateRange(
  rolloutId,
  fromDate,
  toDate,
  limit = 500
) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 1000));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_latency_metrics
      WHERE rollout_id = $1
        AND period_start >= $2
        AND period_start <= $3
      ORDER BY period_start DESC
      LIMIT $4
    `,
    [rolloutId, fromDate, toDate, safeLimit]
  );

  return result.rows;
}

async function update(
  rolloutId,
  latencyBucket,
  periodStart,
  updates
) {
  const db = getClient();

  const allowedFields = [
    "period_end",
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
    return findByLatencyAndPeriod(
      rolloutId,
      latencyBucket,
      periodStart
    );
  }

  const values = entries.map(([, value]) => value);

  const setClause = entries
    .map(([field], index) => `${field} = $${index + 4}`)
    .join(", ");

  const result = await db.query(
    `
      UPDATE download_strategy_rollout_latency_metrics
      SET ${setClause},
          updated_at = NOW()
      WHERE rollout_id = $1
        AND latency_bucket = $2
        AND period_start = $3
      RETURNING *
    `,
    [
      rolloutId,
      latencyBucket,
      periodStart,
      ...values,
    ]
  );

  return result.rows[0] || null;
}

async function deleteByRolloutId(rolloutId) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM download_strategy_rollout_latency_metrics
      WHERE rollout_id = $1
    `,
    [rolloutId]
  );

  return result.rowCount;
}

async function deleteByLatencyBucket(latencyBucket) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM download_strategy_rollout_latency_metrics
      WHERE latency_bucket = $1
    `,
    [latencyBucket]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findByRolloutId,
  findByLatencyBucket,
  findByLatencyAndPeriod,
  findByDateRange,
  update,
  deleteByRolloutId,
  deleteByLatencyBucket,
};
