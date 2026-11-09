
const fs = require("fs");
const path = require("path");

const adminService = require("../services/admin.service");
const mediaRepository = require("../repositories/zeka-media.repository");
const { deleteFile } = require("../services/file.service");
const {
  recoverZekaMediaFile,
} = require("../services/zeka-media-recovery.service");

const PERMISSION = "zeka_media";
const CHANNEL = "@zeka_media";
const PANEL_BUTTON = "📺 مدیریت زکا مدیا";
const PANEL_PAGE_SIZE = 5;

const MAX_TELEGRAM_UPLOAD_BYTES = 50 * 1024 * 1024;

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

const recoveredMediaFiles = new Map();
const activeActions = new Set();

function setBot(bot) {
  botInstance = bot;
}

async function answerCallback(ctx, message = "") {
  try {
    await ctx.answerCbQuery(message);
  } catch (error) {
    console.warn(
      "Zeka Media callback acknowledgement failed:",
      error.message
    );
  }
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
    [".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(extension)
  ) {
    return "sendPhoto";
  }

  if (
    type === "VIDEO" ||
    [".mp4", ".mov", ".webm", ".mkv"].includes(extension)
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

function buildRetryKeyboard(queueId) {
  return {
    inline_keyboard: [
      [
        {
          text: "🔄 تلاش مجدد برای دانلود",
          callback_data: `zeka_media:retry:${queueId}`,
        },
        {
          text: "❌ رد درخواست",
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

async function safeDeleteFile(filePath) {
  if (!filePath) return;

  try {
    await deleteFile(filePath);
  } catch (error) {
    console.warn(
      "Zeka Media file cleanup failed:",
      filePath,
      error.message
    );
  }
}

function getFileInfo(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    const error = new Error("فایل محلی موجود نیست.");
    error.zekaMediaStage = "FILE_CHECK";
    throw error;
  }

  const stats = fs.statSync(filePath);

  if (!stats.isFile()) {
    const error = new Error("مسیر فایل معتبر نیست.");
    error.zekaMediaStage = "FILE_CHECK";
    throw error;
  }

  return {
    sizeBytes: stats.size,
    sizeMB: Number(
      (stats.size / (1024 * 1024)).toFixed(2)
    ),
  };
}

/**
 * ارسال فایل به تلگرام با Buffer.
 * هیچ Retry خودکاری در این تابع وجود ندارد.
 */
async function sendTelegramMedia({
  chatId,
  queueId,
  filePath,
  contentType,
  caption,
  replyMarkup,
  purpose,
}) {
  if (!botInstance) {
    throw new Error("Zeka Media bot is not initialized");
  }

  let fileInfo;

  try {
    fileInfo = getFileInfo(filePath);
  } catch (error) {
    error.zekaMediaStage = "FILE_CHECK";
    throw error;
  }

  const method = getChannelMediaMethod({
    file_path: filePath,
    content_type: contentType,
  });

  console.log("Zeka Media upload started:", {
    queueId,
    purpose,
    chatId,
    method,
    filePath,
    fileSizeBytes: fileInfo.sizeBytes,
    fileSizeMB: fileInfo.sizeMB,
    maxUploadSizeMB: 50,
  });

  if (fileInfo.sizeBytes > MAX_TELEGRAM_UPLOAD_BYTES) {
    const error = new Error(
      `حجم فایل ${fileInfo.sizeMB} مگابایت است و از محدودیت ۵۰ مگابایتی آپلود تلگرام بیشتر است.`
    );

    error.code = "ZEKA_MEDIA_FILE_TOO_LARGE";
    error.zekaMediaStage = "FILE_TOO_LARGE";
    error.fileSizeBytes = fileInfo.sizeBytes;
    error.fileSizeMB = fileInfo.sizeMB;

    console.error("Zeka Media upload rejected:", {
      queueId,
      purpose,
      fileSizeBytes: fileInfo.sizeBytes,
      fileSizeMB: fileInfo.sizeMB,
      maxUploadSizeMB: 50,
    });

    throw error;
  }

  const startedAt = Date.now();

  try {
    const fileBuffer = await fs.promises.readFile(filePath);

    const result = await botInstance.telegram[method](
      chatId,
      {
        source: fileBuffer,
        filename: path.basename(filePath),
      },
      {
        caption,
        ...(replyMarkup
          ? { reply_markup: replyMarkup }
          : {}),
      }
    );

    const durationMs = Date.now() - startedAt;

    console.log("Zeka Media upload completed:", {
      queueId,
      purpose,
      method,
      fileSizeBytes: fileInfo.sizeBytes,
      fileSizeMB: fileInfo.sizeMB,
      durationMs,
      telegramMessageId: result?.message_id || null,
    });

    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    error.zekaMediaStage = "TELEGRAM_UPLOAD";
    error.fileSizeBytes = fileInfo.sizeBytes;
    error.fileSizeMB = fileInfo.sizeMB;
    error.uploadDurationMs = durationMs;

    console.error("Zeka Media upload failed:", {
      queueId,
      purpose,
      method,
      fileSizeBytes: fileInfo.sizeBytes,
      fileSizeMB: fileInfo.sizeMB,
      durationMs,
      errorCode: error.code || error.errno || null,
      errorMessage: error.message,
      telegramErrorCode: error.response?.error_code || null,
      telegramDescription:
        error.response?.description || null,
    });

    throw error;
  }
}

async function publishToChannel(queueItem) {
  if (!queueItem?.file_path) {
    const error = new Error("مسیر فایل ثبت نشده است.");
    error.publishFailureType = "DEFINITE";
    throw error;
  }

  try {
    return await sendTelegramMedia({
      chatId: CHANNEL,
      queueId: queueItem.id,
      filePath: queueItem.file_path,
      contentType: queueItem.content_type,
      caption: CHANNEL_CAPTION,
      purpose: "CHANNEL_PUBLISH",
    });
  } catch (error) {
    if (
      error.zekaMediaStage === "FILE_CHECK" ||
      error.zekaMediaStage === "FILE_TOO_LARGE"
    ) {
      error.publishFailureType = "DEFINITE";
    } else {
      error.publishFailureType = "UNKNOWN";
    }

    throw error;
  }
}

/**
 * فایل موجود را برمی‌گرداند.
 * دانلود مجدد فقط در مسیر Retry دستی مجاز است.
 */
async function getAvailableMedia(item, allowRecovery = false) {
  const cached = recoveredMediaFiles.get(Number(item.id));

  if (
    cached?.filePath &&
    fs.existsSync(cached.filePath)
  ) {
    return {
      filePath: cached.filePath,
      contentType: cached.contentType,
    };
  }

  if (
    item.file_path &&
    fs.existsSync(item.file_path)
  ) {
    return {
      filePath: item.file_path,
      contentType: item.content_type || "UNKNOWN",
    };
  }

  if (!allowRecovery) {
    throw new Error(
      "فایل محلی موجود نیست. برای دانلود مجدد، دکمه تلاش مجدد را بزن."
    );
  }

  const recovered = await recoverZekaMediaFile(item);

  if (
    !recovered?.filePath ||
    !fs.existsSync(recovered.filePath)
  ) {
    throw new Error("فایل بازیابی‌شده در دسترس نیست.");
  }

  const media = {
    filePath: recovered.filePath,
    contentType: recovered.contentType,
  };

  recoveredMediaFiles.set(Number(item.id), media);

  return media;
}

async function sendMediaPreview(ctx, item, media) {
  const chatId = ctx.chat?.id;

  if (!chatId) {
    throw new Error("شناسه گفتگوی ادمین در دسترس نیست.");
  }

  const caption = [
    "📺 محتوای زکا مدیا",
    "",
    `شناسه: ${item.id}`,
    `وضعیت: ${STATUS_LABELS[item.status] || item.status}`,
    `نوع فایل: ${media.contentType || "UNKNOWN"}`,
    item.original_url
      ? `لینک منبع: ${item.original_url}`
      : null,
    "",
    "محتوا را بررسی کن و سپس تأیید یا رد کن.",
  ]
    .filter(Boolean)
    .join("\n");

  return sendTelegramMedia({
    chatId,
    queueId: item.id,
    filePath: media.filePath,
    contentType: media.contentType,
    caption,
    replyMarkup: buildReviewKeyboard(item.id),
    purpose: "ADMIN_PREVIEW",
  });
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
    const reviewable = ["PENDING", "FAILED"].includes(status);

    const mediaPath =
      recoveredMediaFiles.get(Number(item.id))?.filePath ||
      item.file_path;

    const fileAvailable =
      Boolean(mediaPath) &&
      fs.existsSync(mediaPath);

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
      `فایل: ${fileAvailable ? "موجود" : "در دسترس نیست"}`,
    ]
      .filter(Boolean)
      .join("\n");

    if (reviewable && fileAvailable) {
      try {
        await sendMediaPreview(ctx, item, {
          filePath: mediaPath,
          contentType: item.content_type || "UNKNOWN",
        });
      } catch (error) {
        console.error(
          `Failed to display Zeka Media item ${item.id}:`,
          error
        );

        await ctx.reply(
          [
            "⚠️ ارسال پیش‌نمایش ناموفق بود.",
            "",
            details,
            `علت: ${error.message}`,
          ].join("\n"),
          {
            reply_markup: buildRetryKeyboard(item.id),
          }
        );
      }

      continue;
    }

    if (reviewable) {
      await ctx.reply(
        [
          "📄 درخواست زکا مدیا",
          "",
          details,
          "",
          "فایل محلی موجود نیست. برای دانلود مجدد، خودت دکمه تلاش مجدد را بزن.",
        ].join("\n"),
        {
          reply_markup: buildRetryKeyboard(item.id),
        }
      );

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

  await answerCallback(ctx, "در حال بارگذاری...");

  try {
    const admin = await getAuthorizedAdmin(ctx.from?.id);

    if (!admin) {
      await ctx.reply(
        "⛔ دسترسی مدیریت زکا مدیا ندارید."
      );
      return;
    }

    if (!botInstance) {
      await ctx.reply("❌ ربات آماده نیست.");
      return;
    }

    if (data === "zeka_media:home") {
      await sendPanelHome(ctx);
      return;
    }

    const match = data.match(
      /^zeka_media:view:(PENDING|PUBLISHING|PUBLISH_UNKNOWN|PUBLISHED|REJECTED|FAILED|EXPIRED):(\d+)$/
    );

    if (!match) {
      await ctx.reply("درخواست نامعتبر است.");
      return;
    }

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

    await ctx.reply(
      current?.status === "EXPIRED"
        ? "⌛ مهلت بررسی این درخواست تمام شده است."
        : "⚠️ این درخواست قبلاً بررسی شده یا وجود ندارد."
    );

    return;
  }

  const cached = recoveredMediaFiles.get(Number(queueId));

  if (cached?.filePath) {
    await safeDeleteFile(cached.filePath);
  }

  if (
    rejected.file_path &&
    rejected.file_path !== cached?.filePath
  ) {
    await safeDeleteFile(rejected.file_path);
  }

  recoveredMediaFiles.delete(Number(queueId));

  await removeReviewButtons(ctx);

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

    await ctx.reply(
      current?.status === "EXPIRED"
        ? "⌛ مهلت بررسی تمام شده است."
        : current?.status === "PUBLISH_UNKNOWN"
          ? "⚠️ نتیجه انتشار قبلی نامشخص است؛ بررسی دستی لازم است."
          : current?.status === "PUBLISHING"
            ? "⏳ این محتوا در حال انتشار است."
            : "⚠️ این مورد قبلاً بررسی شده یا وجود ندارد."
    );

    return;
  }

  await ctx.reply(
    `⏳ درخواست ${queueId} در حال آماده‌سازی و انتشار است.`
  );

  let media;

  try {
    media = await getAvailableMedia(queueItem, false);
  } catch (error) {
    console.error(
      `Zeka Media local file check failed for ${queueId}:`,
      error
    );

    await mediaRepository.markFailed(queueId);

    await ctx.reply(
      [
        `❌ انتشار درخواست ${queueId} انجام نشد.`,
        `علت: ${error.message}`,
        "",
        "برای دریافت مجدد فایل، از دکمه تلاش مجدد استفاده کن.",
      ].join("\n")
    );

    return;
  }

  const publishItem = {
    ...queueItem,
    file_path: media.filePath,
    content_type: media.contentType,
  };

  let sentMessage;

  try {
    sentMessage = await publishToChannel(publishItem);
  } catch (error) {
    console.error(
      `Zeka Media publish failed for ${queueId}:`,
      error
    );

    if (error.publishFailureType === "DEFINITE") {
      await mediaRepository.markFailed(queueId);

      await ctx.reply(
        `❌ انتشار محتوای ${queueId} انجام نشد؛ وضعیت آن ناموفق ثبت شد.\nعلت: ${error.message}`
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
      `⚠️ محتوا احتمالاً منتشر شده، اما ثبت نتیجه آن در دیتابیس با خطا مواجه شد. شناسه پیام کانال: ${messageId}`
    );

    return;
  }

  await safeDeleteFile(media.filePath);
  recoveredMediaFiles.delete(Number(queueId));

  await removeReviewButtons(ctx);

  await ctx.reply(
    `✅ محتوای زکا مدیا با شناسه ${queueId} منتشر شد.\nشناسه پیام کانال: ${messageId}`
  );
}

async function handleRetry(ctx, queueId) {
  const item = await mediaRepository.findById(queueId);

  if (!item || !["PENDING", "FAILED"].includes(item.status)) {
    await ctx.reply(
      "⚠️ این درخواست دیگر قابل بازیابی نیست."
    );
    return;
  }

  await removeReviewButtons(ctx);

  await ctx.reply(
    `⏳ درخواست ${queueId} در حال بازیابی دستی است. پس از آماده شدن فایل، پیش‌نمایش ارسال می‌شود.`
  );

  let media;
  let recoveryCompleted = false;

  try {
    media = await getAvailableMedia(item, true);
    recoveryCompleted = true;

    await sendMediaPreview(ctx, item, media);

    await ctx.reply(
      `✅ فایل درخواست ${queueId} بازیابی و پیش‌نمایش آن ارسال شد.`
    );
  } catch (error) {
    console.error(
      `Zeka Media manual retry failed for ${queueId}:`,
      error
    );

    let failureMessage;

    if (error.zekaMediaStage === "FILE_TOO_LARGE") {
      failureMessage = [
        "❌ فایل بازیابی شد، اما حجم آن برای ارسال از طریق تلگرام بیش از حد مجاز است.",
        `حجم فایل: ${error.fileSizeMB} مگابایت`,
        "حداکثر حجم مجاز: ۵۰ مگابایت",
      ].join("\n");
    } else if (error.zekaMediaStage === "TELEGRAM_UPLOAD") {
      failureMessage = [
        "⚠️ فایل بازیابی شد، اما ارسال پیش‌نمایش به تلگرام ناموفق بود.",
        `حجم فایل: ${error.fileSizeMB} مگابایت`,
        `مدت تلاش برای ارسال: ${error.uploadDurationMs} میلی‌ثانیه`,
        `خطا: ${error.message}`,
        "",
        "فایل بازیابی‌شده در حافظه موقت نگه داشته شده است. این خطا به معنی شکست دانلود نیست.",
      ].join("\n");
    } else if (recoveryCompleted) {
      failureMessage = [
        "⚠️ فایل بازیابی شد، اما مرحله آماده‌سازی یا ارسال پیش‌نمایش با خطا مواجه شد.",
        `علت: ${error.message}`,
      ].join("\n");
    } else {
      failureMessage = [
        "❌ دانلود مجدد درخواست ناموفق بود.",
        `علت: ${error.message}`,
      ].join("\n");
    }

    await ctx.reply(
      failureMessage,
      {
        reply_markup: buildRetryKeyboard(queueId),
      }
    );
  }
}

async function handleReviewAction(ctx) {
  const match = String(
    ctx.callbackQuery?.data || ""
  ).match(/^zeka_media:(approve|reject|retry):(\d+)$/);

  if (!match) {
    return;
  }

  const action = match[1];
  const queueId = Number(match[2]);
  const telegramUserId = ctx.from?.id;

  await answerCallback(
    ctx,
    action === "approve"
      ? "در حال شروع انتشار..."
      : action === "reject"
        ? "در حال ثبت رد درخواست..."
        : "در حال شروع عملیات دستی..."
  );

  if (!botInstance) {
    await ctx.reply("❌ ربات آماده نیست.");
    return;
  }

  if (activeActions.has(queueId)) {
    await ctx.reply(
      `⏳ عملیات دیگری برای درخواست ${queueId} در حال انجام است.`
    );
    return;
  }

  activeActions.add(queueId);

  try {
    const admin = await getAuthorizedAdmin(telegramUserId);

    if (!admin) {
      await ctx.reply(
        "⛔ دسترسی مدیریت زکا مدیا ندارید."
      );
      return;
    }

    if (action === "reject") {
      await handleReject(ctx, queueId, telegramUserId);
      return;
    }

    if (action === "retry") {
      await handleRetry(ctx, queueId);
      return;
    }

    await handleApprove(ctx, queueId, telegramUserId);
  } catch (error) {
    console.error(
      "Zeka Media review action failed:",
      error
    );

    try {
      await ctx.reply(
        "❌ پردازش درخواست زکا مدیا با خطا مواجه شد. لاگ Render را بررسی کن."
      );
    } catch (replyError) {
      console.error(
        "Could not send Zeka Media error message:",
        replyError
      );
    }
  } finally {
    activeActions.delete(queueId);
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
    /^zeka_media:(approve|reject|retry):(\d+)$/,
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
