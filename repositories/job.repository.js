const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO jobs (
        request_id,
        user_id,
        job_type,
        status,
        priority,
        platform,
        source_url,
        estimated_cost,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      data.requestId,
      data.userId,
      data.jobType || "DOWNLOAD",
      data.status || "WAITING",
      data.priority || "NORMAL",
      data.platform,
      data.sourceUrl,
      data.estimatedCost ?? null,
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
      FROM jobs
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByRequestId(requestId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM jobs
      WHERE request_id = $1
      ORDER BY created_at ASC
    `,
    [requestId]
  );

  return result.rows;
}

async function findPending(limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM jobs
      WHERE status = 'WAITING'
      ORDER BY
        CASE WHEN priority = 'PRO' THEN 0 ELSE 1 END,
        created_at ASC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function updateStatus(id, status) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE jobs
      SET status = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, status]
  );

  return result.rows[0] || null;
}

async function update(id, updates) {
  const db = getClient();

  const allowedFields = [
    "status",
    "priority",
    "estimated_cost",
    "final_cost",
    "started_at",
    "completed_at",
    "cancelled_at",
    "error_code",
    "error_message",
    "attempts",
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
      UPDATE jobs
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
  findByRequestId,
  findPending,
  updateStatus,
  update,
};
