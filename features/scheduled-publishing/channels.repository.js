const { getClient } = require("../../database/client");

async function addUserChannel({
  userId,
  telegramChatId,
  channelTitle = null,
  channelUsername = null,
}) {
  if (!userId || !telegramChatId) {
    throw new Error("User ID and Telegram channel ID are required");
  }

  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO user_channels (
        user_id,
        telegram_chat_id,
        channel_title,
        channel_username,
        is_active
      )
      VALUES ($1, $2, $3, $4, TRUE)
      ON CONFLICT (user_id, telegram_chat_id)
      DO UPDATE SET
        channel_title = EXCLUDED.channel_title,
        channel_username = EXCLUDED.channel_username,
        is_active = TRUE,
        updated_at = NOW()
      RETURNING *
    `,
    [
      userId,
      telegramChatId,
      channelTitle,
      channelUsername,
    ]
  );

  return result.rows[0];
}

async function listUserChannels(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM user_channels
      WHERE user_id = $1
        AND is_active = TRUE
      ORDER BY created_at DESC, id DESC
    `,
    [userId]
  );

  return result.rows;
}

async function getUserChannelById(channelId, userId) {
  if (!channelId || !userId) {
    throw new Error("Channel ID and user ID are required");
  }

  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM user_channels
      WHERE id = $1
        AND user_id = $2
        AND is_active = TRUE
      LIMIT 1
    `,
    [channelId, userId]
  );

  return result.rows[0] || null;
}

async function removeUserChannel(channelId, userId) {
  if (!channelId || !userId) {
    throw new Error("Channel ID and user ID are required");
  }

  const db = getClient();

  const result = await db.query(
    `
      UPDATE user_channels
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE id = $1
        AND user_id = $2
        AND is_active = TRUE
      RETURNING *
    `,
    [channelId, userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  addUserChannel,
  listUserChannels,
  getUserChannelById,
  removeUserChannel,
};
