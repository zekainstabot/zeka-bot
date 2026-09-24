const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_results (
        job_id,
        strategy_id,
        attempt_id,
        status,
        file_path,
        file_url,
        file_type,
        file_size_bytes,
        duration_seconds,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      data.jobId,
      data.strategyId,
      data.attemptId || null,
      data.status || "SUCCESS",
      data.filePath || null,
      data.fileUrl || null,
      data.fileType || null,
      data.fileSizeBytes ?? null,
      data.durationSeconds ?? null,
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
      FROM download_strategy_results
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
      FROM download_strategy_results
      WHERE job_id = $1
      ORDER BY created_at DESC
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
      FROM download_strategy_results
      WHERE strategy_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [strategyId, safeLimit]
  );

  return result.rows;
}

async function findSuccessfulByJobId(jobId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_results
      WHERE job_id = $1
        AND status = 'SUCCESS'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [jobId]
  );

  return result.rows[0] || null;
}

async function update(id, updates) {
  const db = getClient();

  const allowedFields = [
    "status",
    "file_path",
    "file_url",
    "file_type",
    "file_size_bytes",
    "duration_seconds",
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
      UPDATE download_strategy_results
      SET ${setClause},
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

module.exports = {
  create,
  findById,
  findByJobId,
  findByStrategyId,
  findSuccessfulByJobId,
  update,
};
