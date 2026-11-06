const fs = require("fs");
const path = require("path");

const adminService = require("../services/admin.service");
const mediaRepository = require("../repositories/zeka-media.repository");
const { deleteFile } = require("../services/file.service");

const PERMISSION = "zeka_media";
const CHANNEL = "@zeka_media";
const PANEL_BUTTON = "📺 مدیریت زکا مدیا";
const PANEL_PAGE_SIZE = 5;

const CHANNEL_CAPTION = [
  "ZEKA MEDIA",
  "",
  "Discover more with Zeka Media.",
  "",
  "Bot: @zekagpt_bot",
  "Channel: @zeka_media",
].join("\n");

let botInstance = null;

function setBot(bot) {
  botInstance = bot;
}

async function getAuthorizedAdmin(telegramUserId) {
  const admin = await adminService.getAdminByTelegramId(
    telegramUserId
  );

  if (!admin || !admin.is_active) {
    return null;
  }

  if (admin.role_key === "super_admin") {
    return admin;
  }

  const allowed = await adminService.hasPermission(
    admin.user_id,
    PERMISSION
  );

  return allowed ? admin : null;
}

function getChannelMediaMethod(queueItem) {
  const type = String(
    queueItem.content_type || ""
  ).toUpperCase();

  const extension = path.extname(
    queueItem.file_path || ""
  ).toLowerCase();

  if (
    type === "PHOTO" ||
    [".jpg", ".jpeg", ".png", ".webp"].includes(extension)
  ) {
    return "sendPhoto";
  }

  if (
    type === "VIDEO" ||
    [".mp4", ".mov", ".webm"].includes(extension)
  ) {
    return "sendVideo";
  }

  return "sendDocument";
}

function buildReviewKeyboard(queueId) {
  return {
    inline_keyboard: [
      [
        {
          text: "✅ تأیید و انتشار",
          callback_data: `zeka_media:approve:${queueId}`,
        },
        {
          text: "❌ رد و حذف",
          callback_data: `zeka_media:reject:${queueId}`,
        },
      ],
    ],
  };
}

async function publishToChannel(queueItem) {
  if (!botInstance) {
    throw new Error("Zeka Media bot is not initialized");
  }

  if (
    !queueItem?.file_path ||
    !fs.existsSync(queueItem.file_path)
  ) {
    const error = new Error("Queued media file is missing");
    error.publishFailureType = "DEFINITE";
    throw error;
  }

  const method = getChannelMediaMethod(queueItem);
  const stream = fs.createReadStream(queueItem.file_path);

  try {
    return await botInstance.telegram[method](
      CHANNEL,
      { source: stream },
      { caption: CHANNEL_CAPTION }
    );
  } catch (error) {
    stream.destroy();

    // خطای درخواست تلگرام ممکن است بعد از انتشار واقعی رخ داده باشد.
    // بنابراین نتیجه را نامشخص ثبت می‌کنیم تا انتشار تکراری اتفاق نیفتد.
    error.publishFailureType = "UNKNOWN";

    throw error;
  }
}

async function handlePanel(ctx) {
  if (ctx.message?.text !== PANEL_BUTTON) {
    return;
  }

  try {
    const admin = await getAuthorizedAdmin(ctx.from?.id);

    if (!admin) {
      await ctx.reply(
        "⛔ شما اجازه مدیریت زکا مدیا را ندارید."
      );
      return;
    }

    if (!botInstance) {
      await ctx.reply("❌ ربات آماده نیست.");
      return;
    }

    const items = await mediaRepository.listPending(
      PANEL_PAGE_SIZE
    );

    const counts = await mediaRepository.getStatusCounts();

    const pendingCount = counts.PENDING || 0;
    const unknownCount = counts.PUBLISH_UNKNOWN || 0;

    if (!items.length) {
      await ctx.reply(
        [
          "📺 مدیریت زکا مدیا",
          "",
          "در حال حاضر محتوایی برای بررسی وجود ندارد.",
          "",
          `📥 در انتظار بررسی: ${pendingCount}`,
          `⚠️ انتشار نامشخص: ${unknownCount}`,
          `✅ منتشرشده: ${counts.PUBLISHED || 0}`,
          `❌ ردشده: ${counts.REJECTED || 0}`,
          `🚫 ناموفق: ${counts.FAILED || 0}`,
        ].join("\n")
      );
      return;
    }

    await ctx.reply(
      [
        "📺 مدیریت زکا مدیا",
        "",
        `📥 در انتظار بررسی: ${pendingCount}`,
        `⚠️ انتشار نامشخص: ${unknownCount}`,
        `✅ منتشرشده: ${counts.PUBLISHED || 0}`,
        `❌ ردشده: ${counts.REJECTED || 0}`,
        `🚫 ناموفق: ${counts.FAILED || 0}`,
        "",
        `${items.length} مورد از درخواست‌های در انتظار نمایش داده می‌شود.`,
      ].join("\n")
    );

    for (const item of items) {
      const caption = [
        "📺 محتوای در انتظار بررسی زکا مدیا",
        "",
        `شناسه: ${item.id}`,
        `نوع فایل: ${item.content_type || "UNKNOWN"}`,
        item.original_url
          ? `لینک منبع: ${item.original_url}`
          : null,
        "",
        "برای انتشار یا رد محتوا یکی از دکمه‌ها را بزن.",
      ]
        .filter((line) => line !== null)
        .join("\n");

      if (
        !item.file_path ||
        !fs.existsSync(item.file_path)
      ) {
        await ctx.reply(
          `⚠️ فایل محتوای شماره ${item.id} پیدا نشد.`
        );
        continue;
      }

      const method = getChannelMediaMethod(item);
      const stream = fs.createReadStream(item.file_path);

      try {
        await botInstance.telegram[method](
          ctx.chat.id,
          { source: stream },
          {
            caption,
            reply_markup: buildReviewKeyboard(item.id),
          }
        );
      } catch (error) {
        stream.destroy();

        console.error(
          `Failed to display Zeka Media item ${item.id}:`,
          error
        );

        await ctx.reply(
          `❌ نمایش محتوای شماره ${item.id} ناموفق بود.`
        );
      }
    }
  } catch (error) {
    console.error("Zeka Media panel failed:", error);

    await ctx.reply(
      "❌ باز کردن پنل زکا مدیا با خطا مواجه شد. لاگ Render را بررسی کن."
    );
  }
}

async function removeReviewButtons(ctx) {
  try {
    await ctx.editMessageReplyMarkup({
      inline_keyboard: [],
    });
  } catch (error) {
    console.warn(
      "Could not remove review buttons:",
      error.message
    );
  }
}

async function handleReject(ctx, queueId, telegramUserId) {
  const rejected = await mediaRepository.reject(
    queueId,
    telegramUserId
  );

  if (!rejected) {
    const current = await mediaRepository.findById(queueId);

    await ctx.answerCbQuery(
      current?.status === "EXPIRED"
        ? "مهلت بررسی تمام شده است."
        : "این مورد قبلاً بررسی شده یا وجود ندارد.",
      { show_alert: true }
    );

    return;
  }

  const deleted = await deleteFile(rejected.file_path);

  if (!deleted) {
    console.error(
      `Rejected media file could not be deleted: ${queueId}`
    );
  }

  await removeReviewButtons(ctx);

  await ctx.answerCbQuery("محتوا رد شد.");

  await ctx.reply(
    `❌ محتوای زکا مدیا با شناسه ${queueId} رد شد.`
  );
}

async function handleApprove(ctx, queueId, telegramUserId) {
  const queueItem = await mediaRepository.claimForPublishing(
    queueId,
    telegramUserId
  );

  if (!queueItem) {
    const current = await mediaRepository.findById(queueId);

    await ctx.answerCbQuery(
      current?.status === "EXPIRED"
        ? "مهلت بررسی تمام شده است."
        : current?.status === "PUBLISH_UNKNOWN"
          ? "نتیجه انتشار قبلی نامشخص است؛ برای جلوگیری از انتشار تکراری بررسی دستی لازم است."
          : current?.status === "PUBLISHING"
            ? "این محتوا در حال انتشار است."
            : "این مورد قبلاً بررسی شده یا وجود ندارد.",
      { show_alert: true }
    );

    return;
  }

  await ctx.answerCbQuery("در حال انتشار در کانال…");

  let sentMessage;

  try {
    sentMessage = await publishToChannel(queueItem);
  } catch (error) {
    console.error(
      `Zeka Media publish failed for ${queueId}:`,
      error
    );

    if (error.publishFailureType === "DEFINITE") {
      await mediaRepository.markFailed(queueId);

      await ctx.reply(
        `❌ انتشار محتوای ${queueId} انجام نشد؛ فایل موجود نیست و وضعیت آن ناموفق ثبت شد.`
      );
      return;
    }

    await mediaRepository.markPublishUnknown(queueId);

    await ctx.reply(
      [
        `⚠️ نتیجه انتشار محتوای ${queueId} مشخص نیست.`,
        "",
        "ممکن است تلگرام محتوا را منتشر کرده باشد اما پاسخ به ربات نرسیده باشد.",
        "برای جلوگیری از انتشار تکراری، این مورد دوباره خودکار منتشر نمی‌شود.",
        "وضعیت آن در بخش انتشارهای نامشخص قابل بررسی است.",
      ].join("\n")
    );

    return;
  }

  const messageId = sentMessage?.message_id;

  if (!messageId) {
    await mediaRepository.markPublishUnknown(queueId);

    await ctx.reply(
      `⚠️ تلگرام پاسخ معتبر برای محتوای ${queueId} برنگرداند. وضعیت انتشار نامشخص ثبت شد.`
    );

    return;
  }

  try {
    const published = await mediaRepository.markPublished(
      queueId,
      messageId
    );

    if (!published) {
      await mediaRepository.markPublishUnknown(queueId);

      await ctx.reply(
        `⚠️ محتوا در کانال ارسال شد، اما ثبت وضعیت آن کامل نشد. شناسه پیام کانال: ${messageId}`
      );

      return;
    }
  } catch (error) {
    console.error(
      `Could not save published status for ${queueId}:`,
      error
    );

    try {
      await mediaRepository.markPublishUnknown(queueId);
    } catch (statusError) {
      console.error(
        `Could not mark item ${queueId} as unknown:`,
        statusError
      );
    }

    await ctx.reply(
      `⚠️ محتوا احتمالاً منتشر شده، اما ثبت نتیجه در دیتابیس با خطا مواجه شد. شناسه پیام کانال: ${messageId}`
    );

    return;
  }

  const deleted = await deleteFile(queueItem.file_path);

  if (!deleted) {
    console.error(
      `Published media file could not be deleted: ${queueId}`
    );
  }

  await removeReviewButtons(ctx);

  await ctx.reply(
    `✅ محتوای زکا مدیا با شناسه ${queueId} منتشر شد.\nشناسه پیام کانال: ${messageId}`
  );
}

async function handleReviewAction(ctx) {
  const match = String(
    ctx.callbackQuery?.data || ""
  ).match(/^zeka_media:(approve|reject):(\d+)$/);

  if (!match) {
    return;
  }

  if (!botInstance) {
    await ctx.answerCbQuery("ربات آماده نیست.", {
      show_alert: true,
    });
    return;
  }

  const action = match[1];
  const queueId = Number(match[2]);
  const telegramUserId = ctx.from?.id;

  try {
    const admin = await getAuthorizedAdmin(telegramUserId);

    if (!admin) {
      await ctx.answerCbQuery(
        "⛔ دسترسی مدیریت زکا مدیا ندارید.",
        { show_alert: true }
      );
      return;
    }

    if (action === "reject") {
      await handleReject(ctx, queueId, telegramUserId);
      return;
    }

    await handleApprove(ctx, queueId, telegramUserId);
  } catch (error) {
    console.error(
      "Zeka Media review action failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "خطا در پردازش درخواست.",
        { show_alert: true }
      );
    } catch {}

    try {
      await ctx.reply(
        "❌ پردازش درخواست زکا مدیا با خطا مواجه شد. لاگ Render را بررسی کن."
      );
    } catch {}
  }
}

function createZekaMediaHandler(bot) {
  setBot(bot);

  bot.hears(PANEL_BUTTON, handlePanel);

  bot.action(
    /^zeka_media:(approve|reject):\d+$/,
    handleReviewAction
  );
}

module.exports = {
  createZekaMediaHandler,
  setBot,
  getAuthorizedAdmin,
  publishToChannel,
  CHANNEL_CAPTION,
};
