
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

    const items = await mediaRepository.listPending(
      PANEL_PAGE_SIZE
    );

    if (!items.length) {
      await ctx.reply(
        "📺 مدیریت زکا مدیا\n\n" +
        "در حال حاضر محتوایی برای بررسی وجود ندارد."
      );
      return;
    }

    await ctx.reply(
      `📺 مدیریت زکا مدیا\n\n` +
      `${items.length} محتوای در انتظار بررسی نمایش داده می‌شود.\n` +
      `برای جلوگیری از شلوغی، هر بار حداکثر ${PANEL_PAGE_SIZE} مورد نمایش داده می‌شود.`
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

      try {
        await deleteFile(rejected.file_path);
      } catch (error) {
        console.error(
          `Failed to delete rejected media ${queueId}:`,
          error
        );
      }

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
        "محتوا رد شد."
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

      try {
        await deleteFile(queueItem.file_path);
      } catch (error) {
        console.error(
          `Failed to delete published media ${queueId}:`,
          error
        );
      }

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
      console.error(
        `Zeka Media publish failed for ${queueId}:`,
        error
      );

      await ctx.reply(
        `⚠️ انتشار محتوای ${queueId} ناموفق بود. فایل حذف نشده است. برای جلوگیری از انتشار تکراری، وضعیت مورد را در پایگاه داده بررسی کن.`
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
