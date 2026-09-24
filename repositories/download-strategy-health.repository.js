const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_health (
        strategy_id,
        status,
        success_rate,
        average_latency_ms,
        failure_rate,
        checked_at,
        error_message,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      data.strategyId,
      data.status || "UNKNOWN",
      data.successRate ?? null,
      data.averageLatencyMs ?? null,
      data.failureRate ?? null,
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
      FROM download_strategy_health
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findLatestByStrategyId(strategyId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_health
      WHERE strategy_id = $1
      ORDER BY checked_at DESC
      LIMIT 1
    `,
    [strategyId]
  );

  return result.rows[0] || null;
}

async function findHistory(strategyId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_health
      WHERE strategy_id = $1
      ORDER BY checked_at DESC
      LIMIT $2
    `,
    [strategyId, safeLimit]
  );

  return result.rows;
}

async function findByStatus(status, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_health
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
  findLatestByStrategyId,
  findHistory,
  findByStatus,
};
