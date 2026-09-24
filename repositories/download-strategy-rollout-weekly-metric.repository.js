const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_rollout_weekly_metrics (
        rollout_id,
        week_start,
        week_end,
        total_requests,
        successful_requests,
        failed_requests,
        success_rate,
        failure_rate,
        average_latency_ms,
        total_downloads,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `,
    [
      data.rolloutId,
      data.weekStart,
      data.weekEnd,
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
      FROM download_strategy_rollout_weekly_metrics
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
      FROM download_strategy_rollout_weekly_metrics
      WHERE rollout_id = $1
      ORDER BY week_start DESC
      LIMIT $2
    `,
    [rolloutId, safeLimit]
  );

  return result.rows;
}

async function findByWeek(rolloutId, weekStart) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_weekly_metrics
      WHERE rollout_id = $1
        AND week_start = $2
      LIMIT 1
    `,
    [rolloutId, weekStart]
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
      FROM download_strategy_rollout_weekly_metrics
      WHERE rollout_id = $1
        AND week_start >= $2
        AND week_start <= $3
      ORDER BY week_start DESC
      LIMIT $4
    `,
    [rolloutId, fromDate, toDate, safeLimit]
  );

  return result.rows;
}

async function update(rolloutId, weekStart, updates) {
  const db = getClient();

  const allowedFields = [
    "week_end",
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
    return findByWeek(rolloutId, weekStart);
  }

  const values = entries.map(([, value]) => value);

  const setClause = entries
    .map(([field], index) => `${field} = $${index + 3}`)
    .join(", ");

  const result = await db.query(
    `
      UPDATE download_strategy_rollout_weekly_metrics
      SET ${setClause},
          updated_at = NOW()
      WHERE rollout_id = $1
        AND week_start = $2
      RETURNING *
    `,
    [rolloutId, weekStart, ...values]
  );

  return result.rows[0] || null;
}

async function deleteByRolloutId(rolloutId) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM download_strategy_rollout_weekly_metrics
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
  findByWeek,
  findByDateRange,
  update,
  deleteByRolloutId,
};
