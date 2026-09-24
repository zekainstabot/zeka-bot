const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_experiment_results (
        experiment_id,
        strategy_id,
        job_id,
        variant,
        success,
        latency_ms,
        error_code,
        error_message,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      data.experimentId,
      data.strategyId,
      data.jobId || null,
      data.variant || null,
      data.success === true,
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
      FROM download_strategy_experiment_results
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByExperimentId(experimentId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_experiment_results
      WHERE experiment_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [experimentId, safeLimit]
  );

  return result.rows;
}

async function findByStrategyId(strategyId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_experiment_results
      WHERE strategy_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [strategyId, safeLimit]
  );

  return result.rows;
}

async function findByVariant(experimentId, variant, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_experiment_results
      WHERE experiment_id = $1
        AND variant = $2
      ORDER BY created_at DESC
      LIMIT $3
    `,
    [experimentId, variant, safeLimit]
  );

  return result.rows;
}

async function findSuccessful(experimentId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_experiment_results
      WHERE experiment_id = $1
        AND success = TRUE
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [experimentId, safeLimit]
  );

  return result.rows;
}

async function findFailed(experimentId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_experiment_results
      WHERE experiment_id = $1
        AND success = FALSE
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [experimentId, safeLimit]
  );

  return result.rows;
}

module.exports = {
  create,
  findById,
  findByExperimentId,
  findByStrategyId,
  findByVariant,
  findSuccessful,
  findFailed,
};
