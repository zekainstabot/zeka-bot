const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_rollout_circuit_history (
        rollout_id,
        circuit_breaker_id,
        previous_state,
        new_state,
        reason,
        failure_count,
        success_count,
        occurred_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      data.rolloutId,
      data.circuitBreakerId || null,
      data.previousState || null,
      data.newState,
      data.reason || null,
      data.failureCount ?? 0,
      data.successCount ?? 0,
      data.occurredAt || new Date(),
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
      FROM download_strategy_rollout_circuit_history
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
      FROM download_strategy_rollout_circuit_history
      WHERE rollout_id = $1
      ORDER BY occurred_at DESC
      LIMIT $2
    `,
    [rolloutId, safeLimit]
  );

  return result.rows;
}

async function findByCircuitBreakerId(circuitBreakerId, limit = 500) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 1000));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_circuit_history
      WHERE circuit_breaker_id = $1
      ORDER BY occurred_at DESC
      LIMIT $2
    `,
    [circuitBreakerId, safeLimit]
  );

  return result.rows;
}

async function findByState(newState, limit = 500) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 1000));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_circuit_history
      WHERE new_state = $1
      ORDER BY occurred_at DESC
      LIMIT $2
    `,
    [newState, safeLimit]
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
      FROM download_strategy_rollout_circuit_history
      WHERE rollout_id = $1
        AND occurred_at >= $2
        AND occurred_at <= $3
      ORDER BY occurred_at DESC
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
      DELETE FROM download_strategy_rollout_circuit_history
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
  findByCircuitBreakerId,
  findByState,
  findByDateRange,
  deleteByRolloutId,
};
