const { getClient } = require("../database/client");

async function findByUserId(userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM user_channel_destination_limits
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function createOrUpdate(userId, data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO user_channel_destination_limits (
        user_id,
        max_active_channels,
        limit_source,
        is_override,
        reason
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id)
      DO UPDATE SET
        max_active_channels = EXCLUDED.max_active_channels,
        limit_source = EXCLUDED.limit_source,
        is_override = EXCLUDED.is_override,
        reason = EXCLUDED.reason,
        updated_at = NOW()
      RETURNING *
    `,
    [
      userId,
      data.maxActiveChannels,
      data.limitSource || "PRO",
      data.isOverride === true,
      data.reason || null,
    ]
  );

  return result.rows[0];
}

async function updateLimit(userId, maxActiveChannels) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE user_channel_destination_limits
      SET
        max_active_channels = $2,
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `,
    [userId, maxActiveChannels]
  );

  return result.rows[0] || null;
}

async function remove(userId) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM user_channel_destination_limits
      WHERE user_id = $1
      RETURNING *
    `,
    [userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  findByUserId,
  createOrUpdate,
  updateLimit,
  remove,
};
