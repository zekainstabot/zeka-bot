const adminService = require("../services/admin.service");
const requestRepository = require("../repositories/request.repository");
const jobRepository = require("../repositories/job.repository");
const queueManager = require("../queue/manager");
const { recoverJobs } = require("../services/queue-recovery.service");

const PERMISSION = "requests";

function getStatusLabel(status) {
  const labels = {
    WAITING: "⏳ در انتظار",
    PROCESSING: "⚙️ در حال پردازش",
    DOWNLOADING: "📥 در حال دانلود",
    SENDING: "📤 در حال ارسال",
    COMPLETED: "✅ تکمیل شده",
    FAILED: "❌ ناموفق",
    CANCELLED: "🚫 لغو شده",
  };

  return labels[status] || status || "نامشخص";
}

function formatDate(value) {
  if (!value) {
    return "نامشخص";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "نامشخص";
  }

  return date.toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
  });
}

function buildRequestsMenu() {
  return {
    reply_markup: {
      keyboard: [
        [
          "📊 وضعیت Queue",
          "⏳ درخواست‌های در انتظار",
        ],
        [
          "⚙️ درخواست‌های در حال پردازش",
          "❌ درخواست‌های ناموفق",
        ],
        [
          "📋 آخرین درخواست‌ها",
          "🔄 بازیابی درخواست‌ها",
        ],
        [
          "🔙 پنل ادمین",
        ],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

async function getAuthorizedAdmin(ctx) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return null;
  }

  const admin =
    await adminService.getAdminByTelegramId(
      telegramUserId
    );

  if (
    !admin ||
    !admin.is_active
  ) {
    return null;
  }

  const allowed =
    await adminService.hasPermission(
      admin.user_id,
      PERMISSION
    );

  if (!allowed) {
    return null;
  }

  return admin;
}

async function showRequestsMenu(ctx) {
  const admin =
    await getAuthorizedAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ شما به مدیریت درخواست‌ها دسترسی ندارید."
    );

    return;
  }

  await ctx.reply(
    "📥 مدیریت درخواست‌ها\n\n" +
      "یکی از گزینه‌های زیر را انتخاب کن:",
    buildRequestsMenu()
  );
}

async function handleQueueStatus(ctx) {
  const admin =
    await getAuthorizedAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ دسترسی ندارید."
    );

    return;
  }

  const waiting =
    queueManager.getLength();

  const active =
    queueManager.getActiveCount();

  const maxConcurrent =
    queueManager.getMaxConcurrent();

  await ctx.reply(
    "📊 وضعیت Queue\n\n" +
      `⏳ در صف: ${waiting}\n` +
      `⚙️ در حال پردازش: ${active}\n` +
      `🚦 ظرفیت همزمانی: ${maxConcurrent}\n\n` +
      `📌 ظرفیت آزاد: ${Math.max(
        0,
        maxConcurrent - active
      )}`
  );
}

async function handleWaiting(ctx) {
  const admin =
    await getAuthorizedAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ دسترسی ندارید."
    );

    return;
  }

  const jobs =
    await jobRepository.findPending(20);

  if (!jobs.length) {
    await ctx.reply(
      "⏳ در حال حاضر هیچ درخواست منتظری وجود ندارد."
    );

    return;
  }

  const lines = jobs.map(
    (job, index) =>
      `${index + 1}. ${getStatusLabel(
        job.status
      )}\n` +
      `🆔 ${job.job_id || job.id}\n` +
      `🌐 ${job.platform || "نامشخص"}\n` +
      `📅 ${formatDate(job.created_at)}`
  );

  await ctx.reply(
    "⏳ درخواست‌های در انتظار\n\n" +
      lines.join("\n\n")
  );
}

async function handleProcessing(ctx) {
  const admin =
    await getAuthorizedAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ دسترسی ندارید."
    );

    return;
  }

  const jobs =
    await jobRepository.findRecoverable(50);

  const processing =
    jobs.filter(
      (job) =>
        job.status === "PROCESSING" ||
        job.status === "DOWNLOADING" ||
        job.status === "SENDING"
    );

  if (!processing.length) {
    await ctx.reply(
      "⚙️ هیچ درخواست فعالی در حال پردازش نیست."
    );

    return;
  }

  const lines = processing.map(
    (job, index) =>
      `${index + 1}. ${getStatusLabel(
        job.status
      )}\n` +
      `🆔 ${job.job_id || job.id}\n` +
      `🌐 ${job.platform || "نامشخص"}\n` +
      `📅 ${formatDate(job.created_at)}`
  );

  await ctx.reply(
    "⚙️ درخواست‌های در حال پردازش\n\n" +
      lines.join("\n\n")
  );
}

async function handleFailed(ctx) {
  const admin =
    await getAuthorizedAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ دسترسی ندارید."
    );

    return;
  }

  const db =
    require("../database/client").getClient();

  const result =
    await db.query(`
      SELECT *
      FROM jobs
      WHERE status = 'FAILED'
      ORDER BY updated_at DESC
      LIMIT 20
    `);

  if (!result.rows.length) {
    await ctx.reply(
      "❌ درخواست ناموفقی پیدا نشد."
    );

    return;
  }

  const lines =
    result.rows.map(
      (job, index) =>
        `${index + 1}. ❌ ناموفق\n` +
        `🆔 ${job.job_id || job.id}\n` +
        `🌐 ${job.platform || "نامشخص"}\n` +
        `⚠️ ${job.error_code || "بدون کد خطا"}\n` +
        `📅 ${formatDate(job.updated_at)}`
    );

  await ctx.reply(
    "❌ درخواست‌های ناموفق\n\n" +
      lines.join("\n\n")
  );
}

async function handleRecent(ctx) {
  const admin =
    await getAuthorizedAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ دسترسی ندارید."
    );

    return;
  }

  const db =
    require("../database/client").getClient();

  const result =
    await db.query(`
      SELECT
        r.*,
        j.job_id,
        j.status AS job_status
      FROM requests r
      LEFT JOIN jobs j
        ON j.request_id = r.id
      ORDER BY r.created_at DESC
      LIMIT 20
    `);

  if (!result.rows.length) {
    await ctx.reply(
      "📋 هنوز هیچ درخواست دانلودی ثبت نشده است."
    );

    return;
  }

  const lines =
    result.rows.map(
      (request, index) =>
        `${index + 1}. ${getStatusLabel(
          request.job_status ||
            request.status
        )}\n` +
        `🆔 ${request.request_id || request.id}\n` +
        `🌐 ${request.platform || "نامشخص"}\n` +
        `💳 هزینه: ${
          request.estimated_cost ??
          "نامشخص"
        }\n` +
        `📅 ${formatDate(
          request.created_at
        )}`
    );

  await ctx.reply(
    "📋 آخرین درخواست‌ها\n\n" +
      lines.join("\n\n")
  );
}

async function handleRecovery(ctx) {
  const admin = await getAuthorizedAdmin(ctx);

  if (!admin) {
    await ctx.reply("⛔ دسترسی ندارید.");
    return;
  }

  try {
    await ctx.reply(
      "🔄 در حال بررسی درخواست‌های گیرکرده..."
    );

    const db = require("../database/client").getClient();

    const result = await db.query(`
      SELECT *
      FROM jobs
      WHERE status IN ('PROCESSING', 'DOWNLOADING')
      ORDER BY updated_at ASC
      LIMIT 100
    `);

    if (!result.rows.length) {
      await ctx.reply(
        "✅ هیچ درخواست گیرکرده‌ای برای بازیابی پیدا نشد."
      );
      return;
    }

    let recovered = 0;

    for (const job of result.rows) {
      try {
        const recoveredJob =
          await jobRepository.recover(job.id);

        if (!recoveredJob) {
          continue;
        }

        queueManager.add(recoveredJob);
        recovered++;

        console.log(
          `Admin recovery: job ${
            recoveredJob.job_id || recoveredJob.id
          } restored from ${job.status} to WAITING.`
        );
      } catch (error) {
        console.error(
          `Admin recovery failed for job ${
            job.job_id || job.id
          }:`,
          error
        );
      }
    }

    await ctx.reply(
      "✅ بازیابی انجام شد.\n\n" +
        `🔄 تعداد بازیابی‌شده: ${recovered}`
    );
  } catch (error) {
    console.error(
      "Admin request recovery failed:",
      error
    );

    await ctx.reply(
      "❌ بازیابی درخواست‌ها انجام نشد."
    );
  }
}
function createAdminRequestsHandler(bot) {
  bot.hears(
    "📥 مدیریت درخواست‌ها",
    showRequestsMenu
  );

  bot.hears(
    "📊 وضعیت Queue",
    handleQueueStatus
  );

  bot.hears(
    "⏳ درخواست‌های در انتظار",
    handleWaiting
  );

  bot.hears(
    "⚙️ درخواست‌های در حال پردازش",
    handleProcessing
  );

  bot.hears(
    "❌ درخواست‌های ناموفق",
    handleFailed
  );

  bot.hears(
    "📋 آخرین درخواست‌ها",
    handleRecent
  );

  bot.hears(
    "🔄 بازیابی درخواست‌ها",
    handleRecovery
  );
}

module.exports = {
  createAdminRequestsHandler,
};
