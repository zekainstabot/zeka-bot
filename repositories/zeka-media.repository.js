const {
  getClient,
} = require("../database/client");

const db = getClient();

async function createPending({
  jobId,
  filePath,
  contentType,
  originalUrl = null,
}) {
  const result = await db.query(
    `
      INSERT INTO zeka_media_queue (
        job_id,
        file_path,
        content_type,
        original_url,
        status,
        expires_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'PENDING',
        NOW() + INTERVAL '14 days'
      )
      ON CONFLICT (job_id)
      DO NOTHING
      RETURNING *
    `,
    [
      jobId,
      filePath,
      contentType || "UNKNOWN",
      originalUrl,
    ]
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  return findByJobId(jobId);
}

async function findById(id) {
  const result = await db.query(
    `
      SELECT *
      FROM zeka_media_queue
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByJobId(jobId) {
  const result = await db.query(
    `
      SELECT *
      FROM zeka_media_queue
      WHERE job_id = $1
      LIMIT 1
    `,
    [jobId]
  );

  return result.rows[0] || null;
}

async function listPending(limit = 20) {
  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 20, 100)
  );

  const result = await db.query(
    `
      SELECT *
      FROM zeka_media_queue
      WHERE status = 'PENDING'
        AND expires_at > NOW()
      ORDER BY created_at ASC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function claimForPublishing(id, reviewerTelegramId) {
  const result = await db.query(
    `
      UPDATE zeka_media_queue
      SET
        status = 'PUBLISHING',
        reviewed_by = $2,
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
        AND status = 'PENDING'
        AND expires_at > NOW()
      RETURNING *
    `,
    [id, reviewerTelegramId]
  );

  return result.rows[0] || null;
}

async function reject(id, reviewerTelegramId) {
  const result = await db.query(
    `
      UPDATE zeka_media_queue
      SET
        status = 'REJECTED',
        reviewed_by = $2,
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
        AND status = 'PENDING'
        AND expires_at > NOW()
      RETURNING *
    `,
    [id, reviewerTelegramId]
  );

  return result.rows[0] || null;
}

async function markPublished(id, messageId) {
  const result = await db.query(
    `
      UPDATE zeka_media_queue
      SET
        status = 'PUBLISHED',
        published_at = NOW(),
        published_message_id = $2,
        updated_at = NOW()
      WHERE id = $1
        AND status = 'PUBLISHING'
      RETURNING *
    `,
    [id, messageId]
  );

  return result.rows[0] || null;
}

async function markFailed(id) {
  const result = await db.query(
    `
      UPDATE zeka_media_queue
      SET
        status = 'FAILED',
        updated_at = NOW()
      WHERE id = $1
        AND status = 'PUBLISHING'
      RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function expirePending() {
  const result = await db.query(
    `
      UPDATE zeka_media_queue
      SET
        status = 'EXPIRED',
        updated_at = NOW()
      WHERE status = 'PENDING'
        AND expires_at <= NOW()
      RETURNING *
    `
  );

  return result.rows;
}

module.exports = {
  createPending,
  findById,
  findByJobId,
  listPending,
  claimForPublishing,
  reject,
  markPublished,
  markFailed,
  expirePending,
};
