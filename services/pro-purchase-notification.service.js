
const { getClient } = require("../database/client");

const BATCH_SIZE = 10;
const LOCK_TIMEOUT_MINUTES = 5;
const MAX_RETRY_DELAY_MINUTES = 60;

async function claimNotifications(limit = BATCH_SIZE) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || BATCH_SIZE, 50)
  );

  const result = await db.query(
    `
      WITH candidates AS (
        SELECT id
        FROM pro_purchase_notification_outbox
        WHERE (
          status = 'PENDING'
          AND next_attempt_at <= NOW()
        )
        OR (
          status = 'PROCESSING'
          AND locked_at < NOW() - ($2 * INTERVAL '1 minute')
        )
        ORDER BY next_attempt_at ASC, id ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE pro_purchase_notification_outbox AS notification
      SET
        status = 'PROCESSING',
        locked_at = NOW(),
        attempts = notification.attempts + 1
      FROM candidates
      WHERE notification.id = candidates.id
      RETURNING notification.*
    `,
    [safeLimit, LOCK_TIMEOUT_MINUTES]
  );

  return result.rows;
}

async function markNotificationSent(id) {
  const db = getClient();

  await db.query(
    `
      UPDATE pro_purchase_notification_outbox
      SET
        status = 'SENT',
        sent_at = NOW(),
        locked_at = NULL,
        last_error = NULL
      WHERE id = $1
        AND status = 'PROCESSING'
    `,
    [id]
  );
}

async function markNotificationFailed(id, attempts, error) {
  const db = getClient();

  const delayMinutes = Math.min(
    Math.pow(2, Math.max(0, Number(attempts) - 1)),
    MAX_RETRY_DELAY_MINUTES
  );

  await db.query(
    `
      UPDATE pro_purchase_notification_outbox
      SET
        status = 'PENDING',
        locked_at = NULL,
        next_attempt_at = NOW() + ($2 * INTERVAL '1 minute'),
        last_error = $3
      WHERE id = $1
        AND status = 'PROCESSING'
    `,
    [
      id,
      delayMinutes,
      String(error?.message || error || "Unknown error").slice(0, 2000),
    ]
  );
}

async function getNotificationStats() {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        status,
        COUNT(*)::INTEGER AS count
      FROM pro_purchase_notification_outbox
      GROUP BY status
    `
  );

  return result.rows;
}

module.exports = {
  claimNotifications,
  markNotificationSent,
  markNotificationFailed,
  getNotificationStats,
};
