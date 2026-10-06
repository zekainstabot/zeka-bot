const Markup = require("telegraf").Markup;

const adminManagementService = require(
  "../services/admin-management.service"
);

const bugReportRepository = require(
  "../repositories/bug-report.repository"
);

const states = new Map();

const PERMISSION = "bug_reports";

const SECTIONS = {
  PENDING: "pending",
  REVIEWED: "reviewed",
  UNREVIEWED: "unreviewed",
};

function getState(telegramUserId) {
  return (
    states.get(telegramUserId) || {
      section: SECTIONS.PENDING,
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

  if (status === "UNREVIEWED") {
    return "🗃 بررسی‌نشده";
  }

  return "⏳ در انتظار بررسی";
}

function getSectionTitle(section) {
  if (section === SECTIONS.REVIEWED) {
    return "📚 آرشیو بررسی‌شده";
  }

  if (section === SECTIONS.UNREVIEWED) {
    return "🗃 آرشیو بررسی‌نشده";
  }

  return "⏳ گزارش‌های در انتظار بررسی";
}

function buildReportText(report, section, offset, total) {
  return (
    getSectionTitle(section) +
    "\n\n" +
    "🐞 گزارش مشکل\n\n" +
    `🆔 شناسه گزارش: ${report.id}\n` +
    `📌 وضعیت: ${formatStatus(report.status)}\n` +
    `📅 تاریخ ثبت: ${formatDate(report.created_at)}\n\n` +
    `👤 نام: ${report.display_name || "ثبت نشده"}\n` +
    `🔹 Username: ${
      report.username
        ? `@${report.username.replace(/^@/, "")}`
        : "ندارد"
    }\n` +
    `🆔 Telegram ID: ${report.telegram_user_id}\n\n` +
    `📝 مشکل:\n${report.report || "ثبت نشده"}\n\n` +
    `🔗 لینک:\n${report.original_url || "ثبت نشده"}\n\n` +
    `🧾 Job ID: ${report.job_id || "ثبت نشده"}\n\n` +
    `📊 گزارش ${offset + 1} از ${total}`
  );
}

function buildButtons(
  report,
  section,
  offset,
  total
) {
  const rows = [];

  const navigation = [];

  if (offset > 0) {
    navigation.push(
      Markup.button.callback(
        "⬅️ قبلی",
        `${section}:prev`
      )
    );
  }

  if (offset + 1 < total) {
    navigation.push(
      Markup.button.callback(
        "بعدی ➡️",
        `${section}:next`
      )
    );
  }

  if (navigation.length) {
    rows.push(navigation);
  }

  if (section === SECTIONS.UNREVIEWED) {
    rows.push([
      Markup.button.callback(
        "✅ بررسی شد و انتقال به آرشیو بررسی‌شده",
        `bug_reports:review:${report.id}`
      ),
    ]);
  }

  if (section === SECTIONS.REVIEWED) {
    rows.push([
      Markup.button.callback(
        "↩️ بازگرداندن به بررسی",
        `bug_reports:pending:${report.id}`
      ),
    ]);
  }

  if (section === SECTIONS.PENDING) {
    rows.push([
      Markup.button.callback(
        "📚 آرشیو بررسی‌شده",
        "bug_reports:reviewed_archive"
      ),
      Markup.button.callback(
        "🗃 آرشیو بررسی‌نشده",
        "bug_reports:unreviewed_archive"
      ),
    ]);
  } else if (section === SECTIONS.REVIEWED) {
    rows.push([
      Markup.button.callback(
        "🗃 آرشیو بررسی‌نشده",
        "bug_reports:unreviewed_archive"
      ),
      Markup.button.callback(
        "⏳ در انتظار بررسی",
        "bug_reports:pending_list"
      ),
    ]);
  } else if (section === SECTIONS.UNREVIEWED) {
    rows.push([
      Markup.button.callback(
        "📚 آرشیو بررسی‌شده",
        "bug_reports:reviewed_archive"
      ),
      Markup.button.callback(
        "⏳ در انتظار بررسی",
        "bug_reports:pending_list"
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
      `${section}:refresh`
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

async function showSection(
  ctx,
  section,
  offset = 0
) {
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

  let reports = [];

  if (section === SECTIONS.PENDING) {
    reports =
      await bugReportRepository.findPending(200);
  } else if (section === SECTIONS.REVIEWED) {
    reports =
      await bugReportRepository.findByStatus(
        "REVIEWED",
        100
      );
  } else {
    reports =
      await bugReportRepository.findByStatus(
        "UNREVIEWED",
        100
      );
  }

  const total = reports.length;

  if (!total) {
    setState(telegramUserId, {
      section,
      offset: 0,
    });

    const text =
      getSectionTitle(section) +
      "\n\n" +
      (
        section === SECTIONS.PENDING
          ? "✅ هیچ گزارش در انتظاری وجود ندارد."
          : section === SECTIONS.REVIEWED
            ? "📭 آرشیو بررسی‌شده خالی است."
            : "📭 آرشیو بررسی‌نشده خالی است."
      );

    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, {
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "⏳ در انتظار بررسی",
                "bug_reports:pending_list"
              ),
              Markup.button.callback(
                "📚 بررسی‌شده",
                "bug_reports:reviewed_archive"
              ),
            ],
            [
              Markup.button.callback(
                "🗃 بررسی‌نشده",
                "bug_reports:unreviewed_archive"
              ),
            ],
            [
              Markup.button.callback(
                "🔄 تازه‌سازی",
                `${section}:refresh`
              ),
              Markup.button.callback(
                "🔙 پنل ادمین",
                "bug_reports:back"
              ),
            ],
          ]),
        });
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

  const report = reports[safeOffset];

  if (!report) {
    await ctx.reply(
      "❌ گزارش موردنظر پیدا نشد."
    );

    return;
  }

  setState(telegramUserId, {
    section,
    offset: safeOffset,
  });

  const text = buildReportText(
    report,
    section,
    safeOffset,
    total
  );

  const keyboard = buildButtons(
    report,
    section,
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
  await showSection(
    ctx,
    SECTIONS.PENDING,
    0
  );
}

async function handlePendingList(ctx) {
  try {
    await ctx.answerCbQuery();

    await showSection(
      ctx,
      SECTIONS.PENDING,
      0
    );
  } catch (error) {
    console.error(
      "Bug reports pending list failed:",
      error
    );
  }
}

async function handleReviewedArchive(ctx) {
  try {
    await ctx.answerCbQuery();

    await showSection(
      ctx,
      SECTIONS.REVIEWED,
      0
    );
  } catch (error) {
    console.error(
      "Bug reports reviewed archive failed:",
      error
    );
  }
}

async function handleUnreviewedArchive(ctx) {
  try {
    await ctx.answerCbQuery();

    await showSection(
      ctx,
      SECTIONS.UNREVIEWED,
      0
    );
  } catch (error) {
    console.error(
      "Bug reports unreviewed archive failed:",
      error
    );
  }
}

async function handlePrevious(
  ctx,
  section
) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  try {
    await ctx.answerCbQuery();

    const state =
      getState(telegramUserId);

    await showSection(
      ctx,
      section,
      Math.max(0, state.offset - 1)
    );
  } catch (error) {
    console.error(
      "Bug reports previous failed:",
      error
    );
  }
}

async function handleNext(
  ctx,
  section
) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  try {
    await ctx.answerCbQuery();

    const state =
      getState(telegramUserId);

    await showSection(
      ctx,
      section,
      state.offset + 1
    );
  } catch (error) {
    console.error(
      "Bug reports next failed:",
      error
    );
  }
}

async function handleRefresh(
  ctx,
  section
) {
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

    await showSection(
      ctx,
      section,
      state.offset
    );
  } catch (error) {
    console.error(
      "Bug reports refresh failed:",
      error
    );
  }
}

async function handleReview(
  ctx,
  reportId
) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  const allowed =
    await requirePermission(ctx);

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
      "✅ گزارش به آرشیو بررسی‌شده منتقل شد."
    );

    const state =
      getState(telegramUserId);

    await showSection(
      ctx,
      state.section || SECTIONS.UNREVIEWED,
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

async function handlePending(
  ctx,
  reportId
) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  const allowed =
    await requirePermission(ctx);

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

    await showSection(
      ctx,
      SECTIONS.REVIEWED,
      0
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

async function handleDelete(
  ctx,
  reportId
) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  const allowed =
    await requirePermission(ctx);

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

    await showSection(
      ctx,
      state.section || SECTIONS.PENDING,
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
    "bug_reports:pending_list",
    handlePendingList
  );

  bot.action(
    "bug_reports:reviewed_archive",
    handleReviewedArchive
  );

  bot.action(
    "bug_reports:unreviewed_archive",
    handleUnreviewedArchive
  );

  bot.action(
    "pending:prev",
    async (ctx) => {
      await handlePrevious(
        ctx,
        SECTIONS.PENDING
      );
    }
  );

  bot.action(
    "pending:next",
    async (ctx) => {
      await handleNext(
        ctx,
        SECTIONS.PENDING
      );
    }
  );

  bot.action(
    "pending:refresh",
    async (ctx) => {
      await handleRefresh(
        ctx,
        SECTIONS.PENDING
      );
    }
  );

  bot.action(
    "reviewed:prev",
    async (ctx) => {
      await handlePrevious(
        ctx,
        SECTIONS.REVIEWED
      );
    }
  );

  bot.action(
    "reviewed:next",
    async (ctx) => {
      await handleNext(
        ctx,
        SECTIONS.REVIEWED
      );
    }
  );

  bot.action(
    "reviewed:refresh",
    async (ctx) => {
      await handleRefresh(
        ctx,
        SECTIONS.REVIEWED
      );
    }
  );

  bot.action(
    "unreviewed:prev",
    async (ctx) => {
      await handlePrevious(
        ctx,
        SECTIONS.UNREVIEWED
      );
    }
  );

  bot.action(
    "unreviewed:next",
    async (ctx) => {
      await handleNext(
        ctx,
        SECTIONS.UNREVIEWED
      );
    }
  );

  bot.action(
    "unreviewed:refresh",
    async (ctx) => {
      await handleRefresh(
        ctx,
        SECTIONS.UNREVIEWED
      );
    }
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
