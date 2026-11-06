
const fs = require("fs");
const path = require("path");

const adminService = require("../services/admin.service");
const mediaRepository = require("../repositories/zeka-media.repository");
const { deleteFile } = require("../services/file.service");

const PERMISSION = "zeka_media";
const CHANNEL = "@zeka_media";
const PANEL_BUTTON = "📺 مدیریت زکا مدیا";
const PANEL_PAGE_SIZE = 5;

const PANEL_STATUSES = [
  "PENDING",
  "PUBLISHING",
  "PUBLISH_UNKNOWN",
  "PUBLISHED",
  "REJECTED",
  "FAILED",
  "EXPIRED",
];

const STATUS_LABELS = {
  PENDING: "📥 در انتظار بررسی",
  PUBLISHING: "⏳ در حال انتشار",
  PUBLISH_UNKNOWN: "⚠️ انتشار نامشخص",
  PUBLISHED: "✅ منتشرشده",
  REJECTED: "❌ ردشده",
  FAILED: "🚫 ناموفق",
  EXPIRED: "⌛ منقضی‌شده",
};

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

function buildPanelKeyboard(counts) {
  return {
    inline_keyboard: [
      [
        {
          text: `📥 در انتظار (${counts.PENDING || 0})`,
          callback_data: "zeka_media:view:PENDING:0",
        },
        {
          text: `⚠️ نامشخص (${counts.PUBLISH_UNKNOWN || 0})`,
          callback_data: "zeka_media:view:PUBLISH_UNKNOWN:0",
        },
      ],
      [
        {
          text: `⏳ در حال انتشار (${counts.PUBLISHING || 0})`,
          callback_data: "zeka_media:view:PUBLISHING:0",
        },
        {
          text: `✅ منتشرشده (${counts.PUBLISHED || 0})`,
          callback_data: "zeka_media:view:PUBLISHED:0",
        },
      ],
      [
        {
          text: `❌ ردشده (${counts.REJECTED || 0})`,
          callback_data: "zeka_media:view:REJECTED:0",
        },
        {
          text: `🚫 ناموفق (${counts.FAILED || 0})`,
          callback_data: "zeka_media:view:FAILED:0",
        },
      ],
      [
        {
          text: `⌛ منقضی‌شده (${counts.EXPIRED || 0})`,
          callback_data: "zeka_media:view:EXPIRED:0",
        },
      ],
    ],
  };
}

async function sendPanelHome(ctx) {
  const counts = await mediaRepository.getStatusCounts();

  await ctx.reply(
    [
      "📺 مدیریت زکا مدیا",
      "",
      `📥 در انتظار بررسی: ${counts.PENDING || 0}`,
      `⏳ در حال انتشار: ${counts.PUBLISHING || 0}`,
      `⚠️ انتشار نامشخص: ${counts.PUBLISH_UNKNOWN || 0}`,
      `✅ منتشرشده: ${counts.PUBLISHED || 0}`,
      `❌ ردشده: ${counts.REJECTED || 0}`,
      `🚫 ناموفق: ${counts.FAILED || 0}`,
      `⌛ منقضی‌شده: ${counts.EXPIRED || 0}`,
      "",
      "برای مشاهده درخواست‌ها یکی از بخش‌های زیر را انتخاب کن.",
    ].join("\n"),
    {
      reply_markup: buildPanelKeyboard(counts),
    }
  );
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
    error.publishFailureType = "UNKNOWN";
    throw error;
  }
}

async function renderStatusPage(ctx, status, offset = 0) {
  if (!PANEL_STATUSES.includes(status)) {
    await ctx.reply("وضعیت انتخاب‌شده معتبر نیست.");
    return;
  }

  const safeOffset = Math.max(
    0,
    Math.floor(Number(offset) || 0)
  );

  const total = await mediaRepository.countByStatus(status);

  const items =
    status === "PENDING"
      ? await mediaRepository.listPending(
          PANEL_PAGE_SIZE,
          safeOffset
        )
      : await mediaRepository.listByStatus(
          status,
          PANEL_PAGE_SIZE,
          safeOffset
        );

  const pageNumber =
    Math.floor(safeOffset / PANEL_PAGE_SIZE) + 1;

  const totalPages = Math.max(
    1,
    Math.ceil(total / PANEL_PAGE_SIZE)
  );

  await ctx.reply(
    [
      STATUS_LABELS[status],
      "",
      `تعداد کل: ${total}`,
      `صفحه: ${pageNumber} از ${totalPages}`,
    ].join("\n")
  );

  for (const item of items) {
    const fileAvailable =
      Boolean(item.file_path) &&
      fs.existsSync(item.file_path);

    const details = [
      `شناسه: ${item.id}`,
      `وضعیت: ${STATUS_LABELS[status]}`,
      `نوع فایل: ${item.content_type || "UNKNOWN"}`,
      item.original_url
        ? `لینک منبع: ${item.original_url}`
        : null,
      item.published_message_id
        ? `شناسه پیام کانال: ${item.published_message_id}`
        : null,
      item.file_path
        ? `فایل: ${fileAvailable ? "موجود" : "حذف‌شده یا در دسترس نیست"}`
        : "فایل: ثبت نشده",
    ]
      .filter(Boolean)
      .join("\n");

    if (status === "PENDING") {
      const caption = [
        "📺 محتوای در انتظار بررسی زکا مدیا",
        "",
        details,
        "",
        "برای انتشار یا رد محتوا یکی از دکمه‌ها را بزن.",
      ].join("\n");

      const reviewKeyboard = {
        reply_markup: buildReviewKeyboard(item.id),
      };

      if (!fileAvailable) {
        await ctx.reply(
          [
            "⚠️ فایل این درخواست پیدا نشد.",
            "",
            caption,
            "",
            "انتشار بدون فایل ممکن نیست؛ اما می‌توانی درخواست را رد کنی.",
          ].join("\n"),
          reviewKeyboard
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
          [
            "⚠️ نمایش فایل این درخواست ناموفق بود.",
            "",
            caption,
            "",
            "می‌توانی درخواست را رد کنی یا در صورت موجود بودن فایل، انتشار را امتحان کنی.",
          ].join("\n"),
          reviewKeyboard
        );
      }

      continue;
    }

    await ctx.reply(details);
  }

  const navigationButtons = [];

  if (safeOffset > 0) {
    navigationButtons.push({
      text: "⬅️ صفحه قبل",
      callback_data: `zeka_media:view:${status}:${Math.max(
        0,
        safeOffset - PANEL_PAGE_SIZE
      )}`,
    });
  }

  if (safeOffset + PANEL_PAGE_SIZE < total) {
    navigationButtons.push({
      text: "صفحه بعد ➡️",
      callback_data: `zeka_media:view:${status}:${safeOffset + PANEL_PAGE_SIZE}`,
    });
  }

  const keyboard = [];

  if (navigationButtons.length) {
    keyboard.push(navigationButtons);
  }

  keyboard.push([
    {
      text: "🔙 بازگشت به مدیریت زکا مدیا",
      callback_data: "zeka_media:home",
    },
  ]);

  await ctx.reply(
    "صفحه‌بندی درخواست‌ها",
    {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    }
  );
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

    await sendPanelHome(ctx);

    const pendingCount =
      await mediaRepository.countByStatus("PENDING");

    if (pendingCount > 0) {
      await renderStatusPage(ctx, "PENDING", 0);
    }
  } catch (error) {
    console.error("Zeka Media panel failed:", error);

    await ctx.reply(
      "❌ باز کردن پنل زکا مدیا با خطا مواجه شد. لاگ Render را بررسی کن."
    );
  }
}

async function handlePanelNavigation(ctx) {
  const data = String(
    ctx.callbackQuery?.data || ""
  );

  try {
    const admin = await getAuthorizedAdmin(ctx.from?.id);

    if (!admin) {
      await ctx.answerCbQuery(
        "⛔ دسترسی مدیریت زکا مدیا ندارید.",
        { show_alert: true }
      );
      return;
    }

    if (data === "zeka_media:home") {
      await ctx.answerCbQuery();
      await sendPanelHome(ctx);
      return;
    }

    const match = data.match(
      /^zeka_media:view:(PENDING|PUBLISHING|PUBLISH_UNKNOWN|PUBLISHED|REJECTED|FAILED|EXPIRED):(\d+)$/
    );

    if (!match) {
      await ctx.answerCbQuery("درخواست نامعتبر است.");
      return;
    }

    await ctx.answerCbQuery();

    await renderStatusPage(
      ctx,
      match[1],
      Number(match[2])
    );
  } catch (error) {
    console.error(
      "Zeka Media panel navigation failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "خطا در نمایش درخواست‌ها.",
        { show_alert: true }
      );
    } catch {}

    await ctx.reply(
      "❌ نمایش بخش انتخاب‌شده با خطا مواجه شد."
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
          ? "نتیجه انتشار قبلی نامشخص است؛ بررسی دستی لازم است."
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
    /^zeka_media:(home|view:(PENDING|PUBLISHING|PUBLISH_UNKNOWN|PUBLISHED|REJECTED|FAILED|EXPIRED):\d+)$/,
    handlePanelNavigation
  );

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
