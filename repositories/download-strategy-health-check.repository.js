const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_health_checks (
        strategy_id,
        status,
        response_time_ms,
        success,
        error_code,
        error_message,
        checked_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      data.strategyId,
      data.status || "UNKNOWN",
      data.responseTimeMs ?? null,
      data.success === true,
      data.errorCode || null,
      data.errorMessage || null,
      data.checkedAt || new Date(),
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
      FROM download_strategy_health_checks
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByStrategyId(strategyId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_health_checks
      WHERE strategy_id = $1
      ORDER BY checked_at DESC
      LIMIT $2
    `,
    [strategyId, safeLimit]
  );

  return result.rows;
}

async function findLatestByStrategyId(strategyId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_health_checks
      WHERE strategy_id = $1
      ORDER BY checked_at DESC
      LIMIT 1
    `,
    [strategyId]
  );

  return result.rows[0] || null;
}

async function findFailed(strategyId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_health_checks
      WHERE strategy_id = $1
        AND success = FALSE
      ORDER BY checked_at DESC
      LIMIT $2
    `,
    [strategyId, safeLimit]
  );

  return result.rows;
}

module.exports = {
  create,
  findById,
  findByStrategyId,
  findLatestByStrategyId,
  findFailed,
};
