const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_rollout_health_history (
        rollout_id,
        health_id,
        status,
        success_rate,
        failure_rate,
        average_latency_ms,
        checked_at,
        recorded_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      data.rolloutId,
      data.healthId || null,
      data.status || "UNKNOWN",
      data.successRate ?? null,
      data.failureRate ?? null,
      data.averageLatencyMs ?? null,
      data.checkedAt || new Date(),
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
      FROM download_strategy_rollout_health_history
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByRolloutId(rolloutId, limit = 500) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 1000));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_health_history
      WHERE rollout_id = $1
      ORDER BY checked_at DESC
      LIMIT $2
    `,
    [rolloutId, safeLimit]
  );

  return result.rows;
}

async function findByStatus(status, limit = 500) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 1000));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_health_history
      WHERE status = $1
      ORDER BY checked_at DESC
      LIMIT $2
    `,
    [status, safeLimit]
  );

  return result.rows;
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
      FROM download_strategy_rollout_health_history
      WHERE rollout_id = $1
        AND checked_at >= $2
        AND checked_at <= $3
      ORDER BY checked_at DESC
      LIMIT $4
    `,
    [rolloutId, fromDate, toDate, safeLimit]
  );

  return result.rows;
}

async function deleteByRolloutId(rolloutId) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM download_strategy_rollout_health_history
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
  findByStatus,
  findByDateRange,
  deleteByRolloutId,
};
