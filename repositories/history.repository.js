const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO history (
        user_id,
        request_id,
        job_id,
        platform,
        content_type,
        content_id,
        original_url,
        normalized_url,
        title,
        description,
        quality,
        file_size_bytes,
        duration_seconds,
        delivered,
        delivered_at,
        metadata
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING *
    `,
    [
      data.userId,
      data.requestId || null,
      data.jobId || null,
      data.platform,
      data.contentType || null,
      data.contentId || null,
      data.originalUrl,
      data.normalizedUrl || null,
      data.title || null,
      data.description || null,
      data.quality || null,
      data.fileSizeBytes ?? null,
      data.durationSeconds ?? null,
      data.delivered ?? false,
      data.deliveredAt || null,
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
      FROM history
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByUserId(userId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM history
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function findByRequestId(requestId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM history
      WHERE request_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [requestId, safeLimit]
  );

  return result.rows;
}

async function findByJobId(jobId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM history
      WHERE job_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [jobId, safeLimit]
  );

  return result.rows;
}

async function findByContentId(contentId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM history
      WHERE content_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [contentId, safeLimit]
  );

  return result.rows;
}

async function findByUrl(normalizedUrl, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM history
      WHERE normalized_url = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [normalizedUrl, safeLimit]
  );

  return result.rows;
}

async function findDelivered(userId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM history
      WHERE user_id = $1
        AND delivered = TRUE
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function findUndelivered(userId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM history
      WHERE user_id = $1
        AND delivered = FALSE
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function markDelivered(id, deliveredAt = null) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE history
      SET
        delivered = TRUE,
        delivered_at = COALESCE($2, NOW())
      WHERE id = $1
      RETURNING *
    `,
    [id, deliveredAt]
  );

  return result.rows[0] || null;
}

async function updateById(id, updates) {
  const db = getClient();

  const allowedFields = [
    "request_id",
    "job_id",
    "platform",
    "content_type",
    "content_id",
    "original_url",
    "normalized_url",
    "title",
    "description",
    "quality",
    "file_size_bytes",
    "duration_seconds",
    "delivered",
    "delivered_at",
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
      UPDATE history
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

async function deleteById(id) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM history
      WHERE id = $1
    `,
    [id]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findByUserId,
  findByRequestId,
  findByJobId,
  findByContentId,
  findByUrl,
  findDelivered,
  findUndelivered,
  markDelivered,
  updateById,
  deleteById,
};
