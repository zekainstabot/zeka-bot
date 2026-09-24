const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO required_channel_verification_logs (
        user_id,
        channel_id,
        status,
        telegram_status,
        is_pro,
        is_admin,
        checked_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      RETURNING *
    `,
    [
      data.userId,
      data.channelId,
      data.status || "UNKNOWN",
      data.telegramStatus || null,
      data.isPro === true,
      data.isAdmin === true,
      data.metadata || null,
    ]
  );

  return result.rows[0];
}

async function findLatestByUserAndChannel(userId, channelId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM required_channel_verification_logs
      WHERE user_id = $1
        AND channel_id = $2
      ORDER BY checked_at DESC
      LIMIT 1
    `,
    [userId, channelId]
  );

  return result.rows[0] || null;
}

async function findRecentByUserId(userId, limit = 20) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));

  const result = await db.query(
    `
      SELECT *
      FROM required_channel_verification_logs
      WHERE user_id = $1
      ORDER BY checked_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function findRecentByChannelId(channelId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM required_channel_verification_logs
      WHERE channel_id = $1
      ORDER BY checked_at DESC
      LIMIT $2
    `,
    [channelId, safeLimit]
  );

  return result.rows;
}

module.exports = {
  create,
  findLatestByUserAndChannel,
  findRecentByUserId,
  findRecentByChannelId,
};
