const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_rollout_events (
        rollout_id,
        user_id,
        job_id,
        event_type,
        strategy_id,
        success,
        latency_ms,
        error_code,
        error_message,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      data.rolloutId,
      data.userId || null,
      data.jobId || null,
      data.eventType,
      data.strategyId || null,
      data.success ?? null,
      data.latencyMs ?? null,
      data.errorCode || null,
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
      FROM download_strategy_rollout_events
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
      FROM download_strategy_rollout_events
      WHERE rollout_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [rolloutId, safeLimit]
  );

  return result.rows;
}

async function findByUserId(userId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_events
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function findByEventType(rolloutId, eventType, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_events
      WHERE rollout_id = $1
        AND event_type = $2
      ORDER BY created_at DESC
      LIMIT $3
    `,
    [rolloutId, eventType, safeLimit]
  );

  return result.rows;
}

async function findSuccessful(rolloutId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_events
      WHERE rollout_id = $1
        AND success = TRUE
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [rolloutId, safeLimit]
  );

  return result.rows;
}

async function findFailed(rolloutId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_events
      WHERE rollout_id = $1
        AND success = FALSE
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [rolloutId, safeLimit]
  );

  return result.rows;
}

module.exports = {
  create,
  findById,
  findByRolloutId,
  findByUserId,
  findByEventType,
  findSuccessful,
  findFailed,
};
