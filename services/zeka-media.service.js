const fs = require("fs");
const adminService = require("./admin.service");
const mediaRepository = require("../repositories/zeka-media.repository");

const PERMISSION = "zeka_media";

let botInstance = null;

function setBot(bot) {
  botInstance = bot;
}

async function getReviewAdmins() {
  const db = require("../database/client").getClient();

  const result = await db.query(`
    SELECT
      u.telegram_user_id,
      a.user_id
    FROM admins a
    JOIN users u
      ON u.id = a.user_id
    JOIN admin_permissions p
      ON p.permission_key = $1
    WHERE a.is_active = TRUE
      AND u.telegram_user_id IS NOT NULL
      AND (
        a.role_id IN (
          SELECT id
          FROM admin_roles
          WHERE role_key = 'super_admin'
        )
        OR EXISTS (
          SELECT 1
          FROM admin_user_permission_overrides ov
          WHERE ov.admin_id = a.id
            AND ov.permission_id = p.id
            AND ov.is_enabled = TRUE
        )
        OR (
          NOT EXISTS (
            SELECT 1
            FROM admin_user_permission_overrides ov
            WHERE ov.admin_id = a.id
              AND ov.permission_id = p.id
          )
          AND EXISTS (
            SELECT 1
            FROM admin_user_permissions aup
            WHERE aup.admin_id = a.id
              AND aup.permission_id = p.id
          )
        )
      )
  `, [PERMISSION]);

  return result.rows;
}

async function sendReviewMedia({
  queueItem,
  caption = "",
}) {
  if (!botInstance) {
    throw new Error("Zeka Media bot is not initialized");
  }

  if (!queueItem?.file_path || !fs.existsSync(queueItem.file_path)) {
    throw new Error("Review file does not exist");
  }

  const admins = await getReviewAdmins();

  if (!admins.length) {
    throw new Error("No active admin has zeka_media permission");
  }

  const keyboard = {
    inline_keyboard: [[
      {
        text: "✅ تأیید و انتشار",
        callback_data: `zeka_media:approve:${queueItem.id}`,
      },
      {
        text: "❌ رد و حذف",
        callback_data: `zeka_media:reject:${queueItem.id}`,
      },
    ]],
  };

  const messageText =
    "📺 محتوای جدید برای بررسی زکا مدیا\n\n" +
    `شناسه: ${queueItem.id}\n` +
    `نوع فایل: ${queueItem.content_type || "UNKNOWN"}\n` +
    (caption ? `توضیحات: ${caption.slice(0, 700)}\n\n` : "\n") +
    "برای انتشار یا حذف، یکی از گزینه‌های زیر را انتخاب کنید.";

  const sent = [];

  for (const admin of admins) {
    const chatId = admin.telegram_user_id;

    try {
      await botInstance.telegram.sendMessage(
        chatId,
        messageText,
        { reply_markup: keyboard }
      );

      const contentType = String(
        queueItem.content_type || ""
      ).toUpperCase();

      const stream = fs.createReadStream(queueItem.file_path);

      if (contentType === "PHOTO" || /\.(jpe?g|png|webp|avif)$/i.test(queueItem.file_path)) {
        await botInstance.telegram.sendPhoto(
          chatId,
          { source: stream },
          { caption: "📺 فایل در انتظار بررسی است." }
        );
      } else if (
        contentType === "VIDEO" ||
        /\.(mp4|mov|webm|mkv)$/i.test(queueItem.file_path)
      ) {
        await botInstance.telegram.sendVideo(
          chatId,
          { source: stream },
          { caption: "📺 فایل در انتظار بررسی است." }
        );
      } else {
        await botInstance.telegram.sendDocument(
          chatId,
          { source: stream },
          { caption: "📺 فایل در انتظار بررسی است." }
        );
      }

      sent.push(chatId);
    } catch (error) {
      console.error(
        `Failed to send Zeka Media review to admin ${chatId}:`,
        error.message
      );
    }
  }

  if (!sent.length) {
    throw new Error("Could not deliver review notification to any authorized admin");
  }

  return sent;
}

async function enqueueForReview({
  jobId,
  filePath,
  contentType,
  originalUrl,
  caption,
}) {
  const queueItem = await mediaRepository.createPending({
    jobId,
    filePath,
    contentType,
    originalUrl,
  });

  if (!queueItem) {
    throw new Error("Could not create Zeka Media queue item");
  }

  if (queueItem.status !== "PENDING") {
    throw new Error(
      `Queue item is not pending: ${queueItem.status}`
    );
  }

  await sendReviewMedia({
    queueItem,
    caption,
  });

  return queueItem;
}

module.exports = {
  setBot,
  getReviewAdmins,
  sendReviewMedia,
  enqueueForReview,
};
