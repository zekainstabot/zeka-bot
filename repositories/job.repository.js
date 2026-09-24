const { getClient } = require("../database/client");

function generateJobId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);

  return `${timestamp}${random}`.slice(0, 32);
}

async function create(data) {
  const db = getClient();

  const jobId = data.jobId || generateJobId();

  const result = await db.query(
    `
      INSERT INTO jobs (
        request_id,
        user_id,
        job_id,
        platform,
        content_type,
        status,
        original_url,
        normalized_url,
        estimated_cost,
        priority,
        is_heavy
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11
      )
      RETURNING *
    `,
    [
      data.requestId,
      data.userId,
      jobId,
      data.platform || null,
      data.contentType || "DOWNLOAD",
      data.status || "WAITING",
      data.originalUrl,
      data.normalizedUrl || data.originalUrl,
      data.estimatedCost ?? null,
      Number(data.priority) || 0,
      data.isHeavy ?? false,
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

async function findByJobId(jobId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM jobs
      WHERE job_id = $1
      LIMIT 1
    `,
    [jobId]
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

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM jobs
      WHERE status = 'WAITING'
      ORDER BY priority DESC, created_at ASC
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
    "content_id",
    "estimated_cost",
    "reserved_cost",
    "final_cost",
    "retry_count",
    "started_at",
    "processing_at",
    "sending_at",
    "completed_at",
    "failed_at",
    "cancelled_at",
    "error_code",
    "error_message",
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
  findByJobId,
  findByRequestId,
  findPending,
  updateStatus,
  update,
};
