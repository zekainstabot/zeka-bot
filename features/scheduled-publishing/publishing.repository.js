
const { getClient } = require("../../database/client");

const ALLOWED_CAPTION_MODES = new Set([
  "original",
  "custom",
  "both",
  "none",
]);

const ALLOWED_CAPTION_ORDERS = new Set([
  "original_first",
  "custom_first",
]);

async function createScheduledPost({
  userId,
  telegramChatId,
  channelTitle = null,
  sourceUrl,
  mediaType = null,
  mediaFileId = null,
  mediaFilePath = null,
  originalCaption = null,
  customCaption = null,
  captionMode = "original",
  captionOrder = "original_first",
  scheduledAt,
}) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!telegramChatId) {
    throw new Error("Telegram channel ID is required");
  }

  if (!sourceUrl || !scheduledAt) {
    throw new Error("Source URL and scheduled time are required");
  }

  if (!ALLOWED_CAPTION_MODES.has(captionMode)) {
    throw new Error("Invalid caption mode");
  }

  if (!ALLOWED_CAPTION_ORDERS.has(captionOrder)) {
    throw new Error("Invalid caption order");
  }

  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO scheduled_posts (
        user_id,
        telegram_chat_id,
        channel_title,
        source_url,
        media_type,
        media_file_id,
        media_file_path,
        original_caption,
        custom_caption,
        caption_mode,
        caption_order,
        scheduled_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12
      )
      RETURNING *
    `,
    [
      userId,
      telegramChatId,
      sourceUrl,
      channelTitle,
      mediaType,
      mediaFileId,
      mediaFilePath,
      originalCaption,
      customCaption,
      captionMode,
      captionOrder,
      scheduledAt,
    ]
  );

  return result.rows[0];
}

async function getScheduledPostById(postId, userId) {
  if (!postId || !userId) {
    throw new Error("Post ID and user ID are required");
  }

  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM scheduled_posts
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
    `,
    [postId, userId]
  );

  return result.rows[0] || null;
}

async function listScheduledPosts(userId, statuses = null) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const db = getClient();

  let result;

  if (Array.isArray(statuses) && statuses.length > 0) {
    result = await db.query(
      `
        SELECT *
        FROM scheduled_posts
        WHERE user_id = $1
          AND status = ANY($2::varchar[])
        ORDER BY scheduled_at ASC, id ASC
      `,
      [userId, statuses]
    );
  } else {
    result = await db.query(
      `
        SELECT *
        FROM scheduled_posts
        WHERE user_id = $1
        ORDER BY scheduled_at ASC, id ASC
      `,
      [userId]
    );
  }

  return result.rows;
}

async function cancelScheduledPost(postId, userId) {
  if (!postId || !userId) {
    throw new Error("Post ID and user ID are required");
  }

  const db = getClient();

  const result = await db.query(
    `
      UPDATE scheduled_posts
      SET
        status = 'cancelled',
        updated_at = NOW()
      WHERE id = $1
        AND user_id = $2
        AND status = 'pending'
      RETURNING *
    `,
    [postId, userId]
  );

  return result.rows[0] || null;
}

async function reschedulePost(postId, userId, scheduledAt) {
  if (!postId || !userId || !scheduledAt) {
    throw new Error(
      "Post ID, user ID and scheduled time are required"
    );
  }

  const db = getClient();

  const result = await db.query(
    `
      UPDATE scheduled_posts
      SET
        scheduled_at = $3,
        status = 'pending',
        error_message = NULL,
        updated_at = NOW()
      WHERE id = $1
        AND user_id = $2
        AND status IN ('pending', 'failed')
      RETURNING *
    `,
    [postId, userId, scheduledAt]
  );

  return result.rows[0] || null;
}

async function updatePostStatus(
  postId,
  status,
  {
    telegramMessageId = null,
    errorMessage = null,
  } = {}
) {
  const allowedStatuses = new Set([
    "pending",
    "processing",
    "published",
    "failed",
    "cancelled",
  ]);

  if (!postId || !allowedStatuses.has(status)) {
    throw new Error("Invalid post ID or status");
  }

  const db = getClient();

  const result = await db.query(
    `
      UPDATE scheduled_posts
      SET
        status = $2,
        telegram_message_id = COALESCE($3, telegram_message_id),
        error_message = $4,
        attempts = attempts +
          CASE WHEN $2 = 'processing' THEN 1 ELSE 0 END,
        published_at =
          CASE WHEN $2 = 'published' THEN NOW()
               ELSE published_at END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [postId, status, telegramMessageId, errorMessage]
  );

  return result.rows[0] || null;
}

module.exports = {
  createScheduledPost,
  getScheduledPostById,
  listScheduledPosts,
  cancelScheduledPost,
  reschedulePost,
  updatePostStatus,
};
