
const fs = require("fs");
const path = require("path");

const adminService = require("../services/admin.service");
const mediaRepository = require("../repositories/zeka-media.repository");
const { deleteFile } = require("../services/file.service");

const PERMISSION = "zeka_media";
const CHANNEL = "@zeka_media";

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

async function publishToChannel(queueItem) {
  if (!fs.existsSync(queueItem.file_path)) {
    throw new Error("Queued media file is missing");
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
    throw error;
  }
}

async function handleReviewAction(ctx) {
  const match = String(
    ctx.callbackQuery?.data || ""
  ).match(/^zeka_media:(approve|reject):(\d+)$/);

  if (!match) return;

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
    const admin = await getAuthorizedAdmin(
      telegramUserId
    );

    if (!admin) {
      await ctx.answerCbQuery(
        "⛔ دسترسی مدیریت زکا مدیا ندارید.",
        { show_alert: true }
      );
      return;
    }

    if (action === "reject") {
      const rejected = await mediaRepository.reject(
        queueId,
        telegramUserId
      );

      if (!rejected) {
        const current = await mediaRepository.findById(
          queueId
        );

        await ctx.answerCbQuery(
          current?.status === "EXPIRED"
            ? "مهلت بررسی تمام شده است."
            : "این مورد قبلاً بررسی شده یا وجود ندارد.",
          { show_alert: true }
        );
        return;
      }

      await deleteFile(rejected.file_path);

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

      await ctx.answerCbQuery(
        "محتوا رد شد و حذف آن انجام شد."
      );

      await ctx.reply(
        `❌ محتوای زکا مدیا با شناسه ${queueId} رد شد.`
      );
      return;
    }

    const queueItem =
      await mediaRepository.claimForPublishing(
        queueId,
        telegramUserId
      );

    if (!queueItem) {
      const current = await mediaRepository.findById(
        queueId
      );

      await ctx.answerCbQuery(
        current?.status === "EXPIRED"
          ? "مهلت بررسی تمام شده است."
          : "این مورد قبلاً بررسی شده یا وجود ندارد.",
        { show_alert: true }
      );
      return;
    }

    await ctx.answerCbQuery(
      "در حال انتشار در کانال…"
    );

    try {
      const sentMessage = await publishToChannel(
        queueItem
      );

      const messageId = sentMessage?.message_id;

      if (!messageId) {
        throw new Error(
          "Telegram did not return the channel message ID"
        );
      }

      await mediaRepository.markPublished(
        queueItem.id,
        messageId
      );

      await deleteFile(queueItem.file_path);

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

      await ctx.reply(
        `✅ محتوای زکا مدیا با شناسه ${queueId} منتشر شد.`
      );
    } catch (error) {
      // Keep PUBLISHING so the cleanup service protects the file.
      console.error(
        `Zeka Media publish failed for ${queueId}:`,
        error
      );

      await ctx.reply(
        `⚠️ انتشار محتوای ${queueId} ناموفق بود. فایل حذف نشده و برای جلوگیری از حذف خودکار محافظت می‌شود.`
      );
    }
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
        "❌ پردازش درخواست زکا مدیا با خطا مواجه شد."
      );
    } catch {}
  }
}

function createZekaMediaHandler(bot) {
  setBot(bot);

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
