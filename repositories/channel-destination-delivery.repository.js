const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO channel_destination_delivery_logs (
        destination_id,
        user_id,
        job_id,
        status,
        file_type,
        file_size_bytes,
        caption,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      data.destinationId,
      data.userId,
      data.jobId || null,
      data.status || "PENDING",
      data.fileType || null,
      data.fileSizeBytes || null,
      data.caption || null,
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
      FROM channel_destination_delivery_logs
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
      FROM channel_destination_delivery_logs
      WHERE job_id = $1
      ORDER BY created_at ASC
    `,
    [jobId]
  );

  return result.rows;
}

async function updateStatus(id, status, data = {}) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE channel_destination_delivery_logs
      SET
        status = $2,
        telegram_message_id = COALESCE($3, telegram_message_id),
        attempts = COALESCE($4, attempts),
        error_type = $5,
        error_code = $6,
        error_message = $7,
        started_at = COALESCE($8, started_at),
        completed_at = COALESCE($9, completed_at),
        metadata = COALESCE($10, metadata)
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      status,
      data.telegramMessageId || null,
      data.attempts ?? null,
      data.errorType || null,
      data.errorCode || null,
      data.errorMessage || null,
      data.startedAt || null,
      data.completedAt || null,
      data.metadata || null,
    ]
  );

  return result.rows[0] || null;
}

async function markStarted(id) {
  return updateStatus(id, "PROCESSING", {
    startedAt: new Date(),
  });
}

async function markCompleted(id, telegramMessageId) {
  return updateStatus(id, "COMPLETED", {
    telegramMessageId,
    completedAt: new Date(),
  });
}

async function markFailed(id, error) {
  return updateStatus(id, "FAILED", {
    completedAt: new Date(),
    errorType: error?.type || null,
    errorCode: error?.code || null,
    errorMessage: error?.message || null,
  });
}

module.exports = {
  create,
  findById,
  findByJobId,
  updateStatus,
  markStarted,
  markCompleted,
  markFailed,
};
