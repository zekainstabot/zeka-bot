const fs = require("fs");
const path = require("path");

const adminService = require("./admin.service");
const adminRepository = require("../repositories/admin.repository");
const mediaRepository = require("../repositories/zeka-media.repository");

const PERMISSION = "zeka_media";

let botInstance = null;

function setBot(bot) {
  botInstance = bot;
}

async function getReviewAdmins() {
  const admins = await adminRepository.getAdmins();
  const reviewers = [];

  for (const admin of admins) {
    if (
      !admin.is_active ||
      !admin.user_id ||
      !admin.telegram_user_id
    ) {
      continue;
    }

    const allowed = await adminService.hasPermission(
      admin.user_id,
      PERMISSION
    );

    if (allowed) {
      reviewers.push(admin);
    }
  }

  return reviewers;
}

function getMediaMethod(queueItem) {
  const contentType = String(
    queueItem.content_type || ""
  ).toUpperCase();

  const extension = path.extname(
    queueItem.file_path || ""
  ).toLowerCase();

  if (
    contentType === "PHOTO" ||
    [".jpg", ".jpeg", ".png", ".webp"].includes(extension)
  ) {
    return "sendPhoto";
  }

  if (
    contentType === "VIDEO" ||
    [".mp4", ".mov", ".webm"].includes(extension)
  ) {
    return "sendVideo";
  }

  return "sendDocument";
}

async function sendReviewMedia({
  queueItem,
  caption = "",
}) {
  if (!botInstance) {
    throw new Error("Zeka Media bot is not initialized");
  }

  if (
    !queueItem ||
    !queueItem.id ||
    !queueItem.file_path ||
    !fs.existsSync(queueItem.file_path)
  ) {
    throw new Error("Review file does not exist");
  }

  const admins = await getReviewAdmins();

  if (!admins.length) {
    throw new Error(
      "No active admin has zeka_media permission"
    );
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

  const messageText = [
    "📺 محتوای جدید برای بررسی زکا مدیا",
    "",
    `شناسه: ${queueItem.id}`,
    `نوع فایل: ${queueItem.content_type || "UNKNOWN"}`,
    caption
      ? `توضیحات: ${String(caption).slice(0, 700)}`
      : null,
    "",
    "برای انتشار یا حذف، یکی از گزینه‌های زیر را انتخاب کن.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const sent = [];
  const mediaMethod = getMediaMethod(queueItem);

  for (const admin of admins) {
    const chatId = admin.telegram_user_id;

    try {
      await botInstance.telegram.sendMessage(
        chatId,
        messageText,
        {
          reply_markup: keyboard,
        }
      );

      const stream = fs.createReadStream(
        queueItem.file_path
      );

      try {
        await botInstance.telegram[mediaMethod](
          chatId,
          { source: stream },
          {
            caption: "📺 فایل در انتظار بررسی است.",
          }
        );
      } catch (error) {
        stream.destroy();
        throw error;
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
    throw new Error(
      "Could not deliver review notification to any authorized admin"
    );
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
  const numericJobId = Number(jobId);

  if (
    !Number.isSafeInteger(numericJobId) ||
    numericJobId <= 0
  ) {
    throw new Error(
      "A valid numeric database job ID is required"
    );
  }

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(
      "Cannot queue a missing media file"
    );
  }

  const queueItem = await mediaRepository.createPending({
    jobId: numericJobId,
    filePath,
    contentType,
    originalUrl,
  });

  if (!queueItem) {
    throw new Error(
      "Could not create Zeka Media queue item"
    );
  }

  if (queueItem.status !== "PENDING") {
    throw new Error(
      `Queue item is not pending: ${queueItem.status}`
    );
  }

  try {
    await sendReviewMedia({
      queueItem,
      caption,
    });
  } catch (error) {
    console.error(
      `Zeka Media item ${queueItem.id} was queued, but review notification failed:`,
      error.message
    );
  }

  return queueItem;
}

module.exports = {
  setBot,
  getReviewAdmins,
  sendReviewMedia,
  enqueueForReview,
};
