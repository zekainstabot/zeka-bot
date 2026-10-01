const db = require("../database");

async function createPending({
  jobId,
  telegramChatId,
}) {
  const result = await db.query(
    `
      INSERT INTO job_deliveries (
        job_id,
        telegram_chat_id,
        status
      )
      VALUES ($1, $2, 'PENDING')
      ON CONFLICT (job_id)
      DO NOTHING
      RETURNING *
    `,
    [
      jobId,
      telegramChatId,
    ]
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  return findByJobId(jobId);
}

async function findByJobId(jobId) {
  const result = await db.query(
    `
      SELECT *
      FROM job_deliveries
      WHERE job_id = $1
      LIMIT 1
    `,
    [jobId]
  );

  return result.rows[0] || null;
}

async function markSent(
  jobId,
  telegramMessageId
) {
  const result = await db.query(
    `
      UPDATE job_deliveries
      SET
        status = 'SENT',
        telegram_message_id = $2,
        sent_at = NOW(),
        updated_at = NOW()
      WHERE job_id = $1
      RETURNING *
    `,
    [
      jobId,
      telegramMessageId,
    ]
  );

  return result.rows[0] || null;
}

async function markUnknown(jobId) {
  const result = await db.query(
    `
      UPDATE job_deliveries
      SET
        status = 'UNKNOWN',
        updated_at = NOW()
      WHERE job_id = $1
      RETURNING *
    `,
    [jobId]
  );

  return result.rows[0] || null;
}

async function markFailed(jobId) {
  const result = await db.query(
    `
      UPDATE job_deliveries
      SET
        status = 'FAILED',
        updated_at = NOW()
      WHERE job_id = $1
      RETURNING *
    `,
    [jobId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createPending,
  findByJobId,
  markSent,
  markUnknown,
  markFailed,
};
