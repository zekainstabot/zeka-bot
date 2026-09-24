const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_attempts (
        job_id,
        strategy_id,
        attempt_number,
        status,
        started_at,
        completed_at,
        error_code,
        error_message,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      data.jobId,
      data.strategyId,
      data.attemptNumber ?? 1,
      data.status || "PENDING",
      data.startedAt || null,
      data.completedAt || null,
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
      FROM download_strategy_attempts
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
      FROM download_strategy_attempts
      WHERE job_id = $1
      ORDER BY attempt_number ASC, id ASC
    `,
    [jobId]
  );

  return result.rows;
}

async function findByStrategyId(strategyId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_attempts
      WHERE strategy_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [strategyId, safeLimit]
  );

  return result.rows;
}

async function update(id, updates) {
  const db = getClient();

  const allowedFields = [
    "attempt_number",
    "status",
    "started_at",
    "completed_at",
    "error_code",
    "error_message",
    "metadata",
  ];

  const entries = Object.entries(updates).filter(([field]) =>
    allowedFields.includes(field)
  );

  if (entries.length === 0) {
    return findById(id);
  }

  const values = entries.map(([, value]) => value);

  const setClause = entries
    .map(([field], index) => `${field} = $${index + 2}`)
    .join(", ");

  const result = await db.query(
    `
      UPDATE download_strategy_attempts
      SET ${setClause},
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

async function markStarted(id) {
  return update(id, {
    status: "PROCESSING",
    started_at: new Date(),
  });
}

async function markCompleted(id) {
  return update(id, {
    status: "COMPLETED",
    completed_at: new Date(),
  });
}

async function markFailed(id, error = {}) {
  return update(id, {
    status: "FAILED",
    completed_at: new Date(),
    error_code: error.code || null,
    error_message: error.message || null,
  });
}

module.exports = {
  create,
  findById,
  findByJobId,
  findByStrategyId,
  update,
  markStarted,
  markCompleted,
  markFailed,
};
