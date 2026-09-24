const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_rollout_error_metrics (
        rollout_id,
        error_code,
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
      data.errorCode,
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
      FROM download_strategy_rollout_error_metrics
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
      FROM download_strategy_rollout_error_metrics
      WHERE rollout_id = $1
      ORDER BY period_start DESC
      LIMIT $2
    `,
    [rolloutId, safeLimit]
  );

  return result.rows;
}

async function findByErrorCode(errorCode, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_error_metrics
      WHERE error_code = $1
      ORDER BY period_start DESC
      LIMIT $2
    `,
    [errorCode, safeLimit]
  );

  return result.rows;
}

async function findByErrorAndPeriod(
  rolloutId,
  errorCode,
  periodStart
) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_error_metrics
      WHERE rollout_id = $1
        AND error_code = $2
        AND period_start = $3
      LIMIT 1
    `,
    [rolloutId, errorCode, periodStart]
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
      FROM download_strategy_rollout_error_metrics
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
  errorCode,
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
    return findByErrorAndPeriod(
      rolloutId,
      errorCode,
      periodStart
    );
  }

  const values = entries.map(([, value]) => value);

  const setClause = entries
    .map(([field], index) => `${field} = $${index + 4}`)
    .join(", ");

  const result = await db.query(
    `
      UPDATE download_strategy_rollout_error_metrics
      SET ${setClause},
          updated_at = NOW()
      WHERE rollout_id = $1
        AND error_code = $2
        AND period_start = $3
      RETURNING *
    `,
    [
      rolloutId,
      errorCode,
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
      DELETE FROM download_strategy_rollout_error_metrics
      WHERE rollout_id = $1
    `,
    [rolloutId]
  );

  return result.rowCount;
}

async function deleteByErrorCode(errorCode) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM download_strategy_rollout_error_metrics
      WHERE error_code = $1
    `,
    [errorCode]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findByRolloutId,
  findByErrorCode,
  findByErrorAndPeriod,
  findByDateRange,
  update,
  deleteByRolloutId,
  deleteByErrorCode,
};
