const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO channel_destination_audit_logs (
        destination_id,
        user_id,
        action,
        old_value,
        new_value,
        success,
        error_type,
        error_message,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      data.destinationId || null,
      data.userId,
      data.action,
      data.oldValue || null,
      data.newValue || null,
      data.success !== false,
      data.errorType || null,
      data.errorMessage || null,
      data.metadata || null,
    ]
  );

  return result.rows[0];
}

async function findByDestinationId(destinationId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM channel_destination_audit_logs
      WHERE destination_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [destinationId, safeLimit]
  );

  return result.rows;
}

async function findByUserId(userId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM channel_destination_audit_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function findByAction(action, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM channel_destination_audit_logs
      WHERE action = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [action, safeLimit]
  );

  return result.rows;
}

module.exports = {
  create,
  findByDestinationId,
  findByUserId,
  findByAction,
};
