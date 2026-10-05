const Markup = require("telegraf").Markup;

const adminManagementService = require(
  "../services/admin-management.service"
);

const bugReportRepository = require(
  "../repositories/bug-report.repository"
);

const states = new Map();

const PERMISSION = "bug_reports";

function getState(telegramUserId) {
  return (
    states.get(telegramUserId) || {
      offset: 0,
    }
  );
}

function setState(telegramUserId, state) {
  states.set(telegramUserId, state);
}

function clearState(telegramUserId) {
  states.delete(telegramUserId);
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

function formatStatus(status) {
  if (status === "REVIEWED") {
    return "✅ بررسی شده";
  }

  return "⏳ در انتظار بررسی";
}

function buildReportText(report) {
  return (
    "🐞 گزارش مشکل\n\n" +
    `🆔 شناسه گزارش: ${report.id}\n` +
    `📌 وضعیت: ${formatStatus(report.status)}\n` +
    `📅 تاریخ: ${formatDate(report.created_at)}\n\n` +
    `👤 نام: ${report.display_name || "ثبت نشده"}\n` +
    `🔹 Username: ${
      report.username
        ? `@${report.username.replace(/^@/, "")}`
        : "ندارد"
    }\n` +
    `🆔 Telegram ID: ${report.telegram_user_id}\n\n` +
    `📝 مشکل:\n${report.report || "ثبت نشده"}\n\n` +
    `🔗 لینک:\n${report.original_url || "ثبت نشده"}\n\n` +
    `🧾 Job ID: ${report.job_id || "ثبت نشده"}`
  );
}

function buildButtons(report, offset, total) {
  const rows = [];

  const navigation = [];

  if (offset > 0) {
    navigation.push(
      Markup.button.callback(
        "⬅️ قبلی",
        "bug_reports:prev"
      )
    );
  }

  if (offset + 1 < total) {
    navigation.push(
      Markup.button.callback(
        "بعدی ➡️",
        "bug_reports:next"
      )
    );
  }

  if (navigation.length) {
    rows.push(navigation);
  }

  if (report.status === "PENDING") {
    rows.push([
      Markup.button.callback(
        "✅ بررسی شد",
        `bug_reports:review:${report.id}`
      ),
    ]);
  } else {
    rows.push([
      Markup.button.callback(
        "↩️ بازگرداندن به بررسی",
        `bug_reports:pending:${report.id}`
      ),
    ]);
  }

  rows.push([
    Markup.button.callback(
      "🗑 حذف گزارش",
      `bug_reports:delete:${report.id}`
    ),
  ]);

  rows.push([
    Markup.button.callback(
      "🔄 تازه‌سازی",
      "bug_reports:refresh"
    ),
    Markup.button.callback(
      "🔙 پنل ادمین",
      "bug_reports:back"
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}

async function requirePermission(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return false;
  }

  try {
    await adminManagementService.requirePermissionByTelegramId(
      telegramUserId,
      PERMISSION
    );

    return true;
  } catch {
    return false;
  }
}

async function showReports(ctx, offset = 0) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  const allowed = await requirePermission(ctx);

  if (!allowed) {
    await ctx.reply(
      "⛔ شما به مدیریت گزارش مشکلات دسترسی ندارید."
    );

    return;
  }

  const total =
    await bugReportRepository.countPending();

  if (!total) {
    clearState(telegramUserId);

    const text =
      "🐞 گزارش مشکلات\n\n" +
      "✅ هیچ گزارش حل‌نشده‌ای وجود ندارد.";

    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(text);
      } else {
        await ctx.reply(text);
      }
    } catch {
      await ctx.reply(text);
    }

    return;
  }

  const safeOffset = Math.max(
    0,
    Math.min(offset, total - 1)
  );

  const reports =
    await bugReportRepository.findPending(
      total
    );

  const report = reports[safeOffset];

  if (!report) {
    await ctx.reply(
      "❌ گزارش موردنظر پیدا نشد."
    );

    return;
  }

  setState(telegramUserId, {
    offset: safeOffset,
  });

  const text =
    buildReportText(report) +
    "\n\n" +
    `📊 گزارش ${safeOffset + 1} از ${total}`;

  const keyboard = buildButtons(
    report,
    safeOffset,
    total
  );

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(
        text,
        keyboard
      );
    } else {
      await ctx.reply(
        text,
        keyboard
      );
    }
  } catch (error) {
    console.error(
      "Show admin bug reports failed:",
      error
    );
  }
}

async function handleBugReports(ctx) {
  await showReports(ctx, 0);
}

async function handlePrevious(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  try {
    await ctx.answerCbQuery();

    const state =
      getState(telegramUserId);

    await showReports(
      ctx,
      Math.max(0, state.offset - 1)
    );
  } catch (error) {
    console.error(
      "Bug reports previous failed:",
      error
    );
  }
}

async function handleNext(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  try {
    await ctx.answerCbQuery();

    const state =
      getState(telegramUserId);

    await showReports(
      ctx,
      state.offset + 1
    );
  } catch (error) {
    console.error(
      "Bug reports next failed:",
      error
    );
  }
}

async function handleRefresh(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  try {
    await ctx.answerCbQuery(
      "در حال تازه‌سازی..."
    );

    const state =
      getState(telegramUserId);

    await showReports(
      ctx,
      state.offset
    );
  } catch (error) {
    console.error(
      "Bug reports refresh failed:",
      error
    );
  }
}

async function handleReview(ctx, reportId) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  const allowed = await requirePermission(ctx);

  if (!allowed) {
    await ctx.answerCbQuery(
      "⛔ دسترسی ندارید.",
      {
        show_alert: true,
      }
    );

    return;
  }

  try {
    const report =
      await bugReportRepository.markReviewed(
        reportId,
        telegramUserId
      );

    if (!report) {
      await ctx.answerCbQuery(
        "❌ گزارش پیدا نشد.",
        {
          show_alert: true,
        }
      );

      return;
    }

    await ctx.answerCbQuery(
      "✅ گزارش بررسی شد."
    );

    const state =
      getState(telegramUserId);

    await showReports(
      ctx,
      state.offset
    );
  } catch (error) {
    console.error(
      "Review bug report failed:",
      error
    );

    await ctx.answerCbQuery(
      "❌ ثبت بررسی انجام نشد.",
      {
        show_alert: true,
      }
    );
  }
}

async function handlePending(ctx, reportId) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  const allowed = await requirePermission(ctx);

  if (!allowed) {
    await ctx.answerCbQuery(
      "⛔ دسترسی ندارید.",
      {
        show_alert: true,
      }
    );

    return;
  }

  try {
    const report =
      await bugReportRepository.markPending(
        reportId
      );

    if (!report) {
      await ctx.answerCbQuery(
        "❌ گزارش پیدا نشد.",
        {
          show_alert: true,
        }
      );

      return;
    }

    await ctx.answerCbQuery(
      "↩️ گزارش دوباره برای بررسی قرار گرفت."
    );

    const state =
      getState(telegramUserId);

    await showReports(
      ctx,
      state.offset
    );
  } catch (error) {
    console.error(
      "Set bug report pending failed:",
      error
    );

    await ctx.answerCbQuery(
      "❌ عملیات انجام نشد.",
      {
        show_alert: true,
      }
    );
  }
}

async function handleDelete(ctx, reportId) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  const allowed = await requirePermission(ctx);

  if (!allowed) {
    await ctx.answerCbQuery(
      "⛔ دسترسی ندارید.",
      {
        show_alert: true,
      }
    );

    return;
  }

  try {
    const deleted =
      await bugReportRepository.deleteById(
        reportId
      );

    if (!deleted) {
      await ctx.answerCbQuery(
        "❌ گزارش پیدا نشد.",
        {
          show_alert: true,
        }
      );

      return;
    }

    await ctx.answerCbQuery(
      "🗑 گزارش حذف شد."
    );

    const state =
      getState(telegramUserId);

    await showReports(
      ctx,
      Math.max(0, state.offset - 1)
    );
  } catch (error) {
    console.error(
      "Delete bug report failed:",
      error
    );

    await ctx.answerCbQuery(
      "❌ حذف گزارش انجام نشد.",
      {
        show_alert: true,
      }
    );
  }
}

async function handleBack(ctx) {
  try {
    await ctx.answerCbQuery();

    clearState(
      ctx.from?.id
    );

    await ctx.reply(
      "🔙 به پنل ادمین برگشتی."
    );
  } catch (error) {
    console.error(
      "Bug reports back failed:",
      error
    );
  }
}

function createAdminBugReportsHandler(bot) {
  bot.hears(
    "🐞 گزارش مشکلات",
    handleBugReports
  );

  bot.action(
    "bug_reports:prev",
    handlePrevious
  );

  bot.action(
    "bug_reports:next",
    handleNext
  );

  bot.action(
    "bug_reports:refresh",
    handleRefresh
  );

  bot.action(
    /^bug_reports:review:(\d+)$/,
    async (ctx) => {
      await handleReview(
        ctx,
        Number(ctx.match[1])
      );
    }
  );

  bot.action(
    /^bug_reports:pending:(\d+)$/,
    async (ctx) => {
      await handlePending(
        ctx,
        Number(ctx.match[1])
      );
    }
  );

  bot.action(
    /^bug_reports:delete:(\d+)$/,
    async (ctx) => {
      await handleDelete(
        ctx,
        Number(ctx.match[1])
      );
    }
  );

  bot.action(
    "bug_reports:back",
    handleBack
  );
}

module.exports = {
  createAdminBugReportsHandler,
};
