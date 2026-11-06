const {
  getClient,
} = require("../database/client");

const db = getClient();

const ALLOWED_STATUSES = [
  "PENDING",
  "PUBLISHING",
  "APPROVED",
  "REJECTED",
  "PUBLISHED",
  "EXPIRED",
  "FAILED",
  "PUBLISH_UNKNOWN",
];

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
    [jobId, filePath, contentType || "UNKNOWN", originalUrl]
  );

  return result.rows[0] || findByJobId(jobId);
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

async function listPending(limit = 20, offset = 0) {
  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 20, 100)
  );

  const safeOffset = Math.max(
    0,
    Number(offset) || 0
  );

  const result = await db.query(
    `
      SELECT *
      FROM zeka_media_queue
      WHERE status = 'PENDING'
        AND expires_at > NOW()
      ORDER BY created_at ASC
      LIMIT $1
      OFFSET $2
    `,
    [safeLimit, safeOffset]
  );

  return result.rows;
}

async function countByStatus(status) {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new Error(`Invalid Zeka Media status: ${status}`);
  }

  const result = await db.query(
    `
      SELECT COUNT(*)::INTEGER AS total
      FROM zeka_media_queue
      WHERE status = $1
    `,
    [status]
  );

  return result.rows[0]?.total || 0;
}

async function getStatusCounts() {
  const result = await db.query(
    `
      SELECT
        status,
        COUNT(*)::INTEGER AS total
      FROM zeka_media_queue
      GROUP BY status
    `
  );

  const counts = {};

  for (const status of ALLOWED_STATUSES) {
    counts[status] = 0;
  }

  for (const row of result.rows) {
    counts[row.status] = row.total;
  }

  return counts;
}

async function listByStatus(
  status,
  limit = 20,
  offset = 0
) {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new Error(`Invalid Zeka Media status: ${status}`);
  }

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 20, 100)
  );

  const safeOffset = Math.max(
    0,
    Number(offset) || 0
  );

  const result = await db.query(
    `
      SELECT *
      FROM zeka_media_queue
      WHERE status = $1
      ORDER BY updated_at DESC
      LIMIT $2
      OFFSET $3
    `,
    [status, safeLimit, safeOffset]
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

async function markPublishUnknown(id) {
  const result = await db.query(
    `
      UPDATE zeka_media_queue
      SET
        status = 'PUBLISH_UNKNOWN',
        updated_at = NOW()
      WHERE id = $1
        AND status = 'PUBLISHING'
      RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function recoverStalePublishing(minutes = 10) {
  const safeMinutes = Math.max(
    1,
    Math.min(Number(minutes) || 10, 1440)
  );

  const result = await db.query(
    `
      UPDATE zeka_media_queue
      SET
        status = 'PUBLISH_UNKNOWN',
        updated_at = NOW()
      WHERE status = 'PUBLISHING'
        AND updated_at <= NOW() - ($1 * INTERVAL '1 minute')
      RETURNING *
    `,
    [safeMinutes]
  );

  return result.rows;
}

async function restoreToPending(id) {
  const result = await db.query(
    `
      UPDATE zeka_media_queue
      SET
        status = 'PENDING',
        reviewed_by = NULL,
        reviewed_at = NULL,
        updated_at = NOW()
      WHERE id = $1
        AND status = 'PUBLISHING'
        AND expires_at > NOW()
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
  countByStatus,
  getStatusCounts,
  listByStatus,
  claimForPublishing,
  reject,
  markPublished,
  markFailed,
  markPublishUnknown,
  recoverStalePublishing,
  restoreToPending,
  expirePending,
};
