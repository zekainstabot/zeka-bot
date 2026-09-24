const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_selection_logs (
        job_id,
        platform_id,
        selected_strategy_id,
        selection_reason,
        selection_score,
        fallback_used,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      data.jobId,
      data.platformId,
      data.selectedStrategyId,
      data.selectionReason || null,
      data.selectionScore ?? null,
      data.fallbackUsed === true,
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
      FROM download_strategy_selection_logs
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByJobId(jobId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_selection_logs
      WHERE job_id = $1
      ORDER BY created_at ASC
    `,
    [jobId]
  );

  return result.rows;
}

async function findByPlatformId(platformId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_selection_logs
      WHERE platform_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [platformId, safeLimit]
  );

  return result.rows;
}

async function findByStrategyId(strategyId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_selection_logs
      WHERE selected_strategy_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [strategyId, safeLimit]
  );

  return result.rows;
}

async function findFallbackSelections(platformId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_selection_logs
      WHERE platform_id = $1
        AND fallback_used = TRUE
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [platformId, safeLimit]
  );

  return result.rows;
}

module.exports = {
  create,
  findById,
  findByJobId,
  findByPlatformId,
  findByStrategyId,
  findFallbackSelections,
};
