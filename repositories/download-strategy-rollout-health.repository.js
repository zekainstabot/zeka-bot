const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_rollout_health (
        rollout_id,
        status,
        success_rate,
        failure_rate,
        average_latency_ms,
        checked_at,
        error_message,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      data.rolloutId,
      data.status || "UNKNOWN",
      data.successRate ?? null,
      data.failureRate ?? null,
      data.averageLatencyMs ?? null,
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
      FROM download_strategy_rollout_health
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findLatestByRolloutId(rolloutId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_health
      WHERE rollout_id = $1
      ORDER BY checked_at DESC
      LIMIT 1
    `,
    [rolloutId]
  );

  return result.rows[0] || null;
}

async function findHistory(rolloutId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_health
      WHERE rollout_id = $1
      ORDER BY checked_at DESC
      LIMIT $2
    `,
    [rolloutId, safeLimit]
  );

  return result.rows;
}

async function findByStatus(status, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_health
      WHERE status = $1
      ORDER BY checked_at DESC
      LIMIT $2
    `,
    [status, safeLimit]
  );

  return result.rows;
}

module.exports = {
  create,
  findById,
  findLatestByRolloutId,
  findHistory,
  findByStatus,
};
