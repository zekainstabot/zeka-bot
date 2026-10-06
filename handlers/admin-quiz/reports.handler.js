const {
  Markup,
} = require("telegraf");

const adminManagementService = require(
  "../../services/admin-management.service"
);

const quizReportService = require(
  "../../services/quiz-report.service"
);

const {
  startDirectEditQuestion,
} = require("./question-editor");

const {
  getState,
  setState,
  clearState,
} = require("./state");

function formatReportReason(reason) {
  const reasons = {
    WRONG_ANSWER:
      "❌ جواب صحیح اشتباه است",

    BAD_QUESTION:
      "❓ متن سؤال مشکل دارد",

    BAD_OPTIONS:
      "🅰️🅱️ گزینه‌ها مشکل دارند",

    DUPLICATE:
      "🔄 سؤال تکراری است",

    UNRELIABLE:
      "⚠️ سؤال مبهم/غیرقابل‌اعتماد است",

    OTHER:
      "📝 سایر",
  };

  return (
    reasons[reason] ||
    reason ||
    "نامشخص"
  );
}

function formatQuestion(question) {
  if (!question) {
    return "❌ سؤال پیدا نشد.";
  }

  return (
    `🆔 شناسه سؤال: ${question.id}\n\n` +
    `❓ ${question.question_text}\n\n` +
    `🅰️ ${question.option_a}\n` +
    `🅱️ ${question.option_b}\n` +
    `©️ ${question.option_c}\n` +
    `🅳 ${question.option_d}\n\n` +
    `✅ پاسخ صحیح: ${question.correct_option}\n` +
    `🏷️ دسته‌بندی: ${question.category || "نامشخص"}\n` +
    `🎯 سختی: ${question.difficulty || "نامشخص"}\n` +
    `📌 وضعیت: ${
      question.question_status ||
      question.status ||
      "نامشخص"
    }\n` +
    `💡 توضیح: ${
      question.explanation || "ندارد"
    }`
  );
}

function buildReportButtons(report) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "👀 مشاهده سؤال",
        `quiz_admin_report_view:${report.id}`
      ),
    ],
    [
      Markup.button.callback(
        "✏️ اصلاح سؤال",
        `quiz_admin_report_edit:${report.id}`
      ),
    ],
    [
      Markup.button.callback(
        "✅ تأیید گزارش",
        `quiz_admin_report_resolve:${report.id}:RESOLVED`
      ),
      Markup.button.callback(
        "❌ رد گزارش",
        `quiz_admin_report_resolve:${report.id}:REJECTED`
      ),
    ],
  ]);
}

async function requireReportViewPermission(
  telegramUserId
) {
  return adminManagementService.requirePermissionByTelegramId(
    telegramUserId,
    "reports"
  );
}

async function requireReportManagePermission(
  telegramUserId
) {
  return adminManagementService.requirePermissionByTelegramId(
    telegramUserId,
    "reports"
  );
}

function buildArchiveReportText(
  report,
  title
) {
  const reporter =
    report.username
      ? `@${report.username}`
      : report.telegram_user_id
        ? String(
            report.telegram_user_id
          )
        : "نامشخص";

  const createdAt =
    report.created_at
      ? new Date(
          report.created_at
        ).toLocaleString("fa-IR")
      : "نامشخص";

  return (
    `${title}\n\n` +
    `📋 گزارش: ${report.id}\n` +
    `👤 گزارش‌دهنده: ${reporter}\n` +
    `🕐 زمان ثبت: ${createdAt}\n` +
    `⚠️ دلیل: ${formatReportReason(
      report.reason
    )}\n` +
    `📌 وضعیت: ${report.status}\n\n` +
    formatQuestion(report)
  );
}

async function sendPendingReports(
  ctx,
  telegramUserId,
  offset = 0,
  reason = null
) {
  await requireReportViewPermission(
    telegramUserId
  );

  const safeOffset = Math.max(
    0,
    Number(offset) || 0
  );

  const state =
    getState(telegramUserId) || {
      mode: "REPORTS",
      offset: 0,
      reason: null,
    };

  state.mode = "REPORTS";
  state.offset = safeOffset;
  state.reason = reason || null;

  setState(
    telegramUserId,
    state
  );

  const reports =
    await quizReportService.listPendingReports(
      telegramUserId,
      {
        limit: 1,
        offset: safeOffset,
        reason: state.reason,
      }
    );

  const total =
    await quizReportService.countPendingReports(
      telegramUserId,
      {
        reason: state.reason,
      }
    );

  if (
    !reports ||
    reports.length === 0
  ) {
    await ctx.reply(
      "🚨 گزارش‌های سؤالات\n\n" +
        "✅ هیچ گزارش در انتظاری با این فیلتر وجود ندارد.",
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "🔎 فیلتر بر اساس دلیل",
            "quiz_admin_reports_filter"
          ),
        ],
        [
          Markup.button.callback(
            "📊 نمایش همه گزارش‌ها",
            "quiz_admin_reports_all"
          ),
        ],
        [
          Markup.button.callback(
            "📂 آرشیو گزارش‌ها",
            "quiz_admin_reports_archive"
          ),
        ],
        [
          Markup.button.callback(
            "🔙 منوی مدیریت مسابقه",
            "quiz_admin_reports_back"
          ),
        ],
      ])
    );

    return;
  }

  const report = reports[0];

  const reporter =
    report.username
      ? `@${report.username}`
      : report.telegram_user_id
        ? String(
            report.telegram_user_id
          )
        : "نامشخص";

  const createdAt =
    report.created_at
      ? new Date(
          report.created_at
        ).toLocaleString("fa-IR")
      : "نامشخص";

  const text =
    "🚨 گزارش سؤال\n\n" +
    `📋 گزارش: ${report.id}\n` +
    `👤 گزارش‌دهنده: ${reporter}\n` +
    `🕐 زمان: ${createdAt}\n` +
    `⚠️ دلیل: ${formatReportReason(
      report.reason
    )}\n\n` +
    formatQuestion(report);

  const buttons = [];

  if (safeOffset > 0) {
    buttons.push([
      Markup.button.callback(
        "⬅️ قبلی",
        `quiz_admin_reports:${safeOffset - 1}`
      ),
    ]);
  }

  if (safeOffset + 1 < total) {
    buttons.push([
      Markup.button.callback(
        "➡️ بعدی",
        `quiz_admin_reports:${safeOffset + 1}`
      ),
    ]);
  }

  buttons.push([
    Markup.button.callback(
      "👀 مشاهده سؤال",
      `quiz_admin_report_view:${report.id}`
    ),
  ]);

  buttons.push([
    Markup.button.callback(
      "✏️ اصلاح سؤال",
      `quiz_admin_report_edit:${report.id}`
    ),
  ]);

  buttons.push([
    Markup.button.callback(
      "✅ تأیید گزارش",
      `quiz_admin_report_resolve:${report.id}:RESOLVED`
    ),
    Markup.button.callback(
      "❌ رد گزارش",
      `quiz_admin_report_resolve:${report.id}:REJECTED`
    ),
  ]);

  buttons.push([
    Markup.button.callback(
      "🔎 تغییر فیلتر",
      "quiz_admin_reports_filter"
    ),
  ]);

  buttons.push([
    Markup.button.callback(
      "📂 آرشیو گزارش‌ها",
      "quiz_admin_reports_archive"
    ),
  ]);

  buttons.push([
    Markup.button.callback(
      "🔙 منوی مدیریت مسابقه",
      "quiz_admin_reports_back"
    ),
  ]);

  await ctx.reply(
    text +
      `\n\n📊 گزارش ${
        safeOffset + 1
      } از ${total}`,
    Markup.inlineKeyboard(buttons)
  );
}

async function sendArchiveMenu(
  ctx,
  telegramUserId
) {
  await requireReportViewPermission(
    telegramUserId
  );

  const pending =
    await quizReportService.countPendingReports(
      telegramUserId
    );

  const unreviewed =
    await quizReportService.countByStatus(
      telegramUserId,
      "UNREVIEWED"
    );

  const reviewed =
    await quizReportService.countReviewedArchive(
      telegramUserId
    );

  await ctx.reply(
    "📂 آرشیو گزارش‌های سؤالات\n\n" +
      `⏳ در انتظار بررسی: ${pending}\n` +
      `🗃 آرشیو بررسی‌نشده: ${unreviewed}\n` +
      `📚 آرشیو بررسی‌شده: ${reviewed}`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `🗃 آرشیو بررسی‌نشده (${unreviewed})`,
          "quiz_admin_archive:UNREVIEWED:0"
        ),
      ],
      [
        Markup.button.callback(
          `📚 آرشیو بررسی‌شده (${reviewed})`,
          "quiz_admin_archive:REVIEWED:0"
        ),
      ],
      [
        Markup.button.callback(
          "🚨 گزارش‌های در انتظار",
          "quiz_admin_reports_all"
        ),
      ],
      [
        Markup.button.callback(
          "🔙 منوی مدیریت مسابقه",
          "quiz_admin_reports_back"
        ),
      ],
    ])
  );
}

async function sendArchiveReports(
  ctx,
  telegramUserId,
  status,
  offset = 0
) {
  await requireReportViewPermission(
    telegramUserId
  );

  const safeOffset = Math.max(
    0,
    Number(offset) || 0
  );

  let reports;
  let total;

  if (status === "REVIEWED") {
    reports =
      await quizReportService.listReviewedArchive(
        telegramUserId,
        {
          limit: 1,
          offset: safeOffset,
        }
      );

    total =
      await quizReportService.countReviewedArchive(
        telegramUserId
      );
  } else {
    reports =
      await quizReportService.listReportsByStatus(
        telegramUserId,
        "UNREVIEWED",
        {
          limit: 1,
          offset: safeOffset,
        }
      );

    total =
      await quizReportService.countByStatus(
        telegramUserId,
        "UNREVIEWED"
      );
  }

  const title =
    status === "REVIEWED"
      ? "📚 آرشیو بررسی‌شده"
      : "🗃 آرشیو بررسی‌نشده";

  if (
    !reports ||
    reports.length === 0
  ) {
    await ctx.reply(
      `${title}\n\n` +
        "این آرشیو فعلاً خالی است.",
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "📂 بازگشت به آرشیوها",
            "quiz_admin_reports_archive"
          ),
        ],
        [
          Markup.button.callback(
            "🔙 منوی مدیریت مسابقه",
            "quiz_admin_reports_back"
          ),
        ],
      ])
    );

    return;
  }

  const report = reports[0];

  const buttons = [];

  if (safeOffset > 0) {
    buttons.push([
      Markup.button.callback(
        "⬅️ قبلی",
        `quiz_admin_archive:${status}:${
          safeOffset - 1
        }`
      ),
    ]);
  }

  if (
    safeOffset + 1 <
    total
  ) {
    buttons.push([
      Markup.button.callback(
        "➡️ بعدی",
        `quiz_admin_archive:${status}:${
          safeOffset + 1
        }`
      ),
    ]);
  }

  buttons.push([
    Markup.button.callback(
      "👀 مشاهده سؤال",
      `quiz_admin_archive_view:${report.id}:${status}`
    ),
  ]);

  if (status === "UNREVIEWED") {
    buttons.push([
      Markup.button.callback(
        "✅ بررسی شد و انتقال به آرشیو بررسی‌شده",
        `quiz_admin_archive_review:${report.id}`
      ),
    ]);
  }

  if (status === "REVIEWED") {
    buttons.push([
      Markup.button.callback(
        "↩️ بازگرداندن به بررسی",
        `quiz_admin_archive_restore:${report.id}`
      ),
    ]);
  }

  buttons.push([
    Markup.button.callback(
      "🗑 حذف گزارش",
      `quiz_admin_archive_delete:${report.id}:${status}`
    ),
  ]);

  buttons.push([
    Markup.button.callback(
      "📂 آرشیوها",
      "quiz_admin_reports_archive"
    ),
  ]);

  buttons.push([
    Markup.button.callback(
      "🔙 منوی مدیریت مسابقه",
      "quiz_admin_reports_back"
    ),
  ]);

  await ctx.reply(
    buildArchiveReportText(
      report,
      title
    ) +
      `\n\n📊 مورد ${
        safeOffset + 1
      } از ${total}`,
    Markup.inlineKeyboard(
      buttons
    )
  );
}

async function handleReportsMenu(ctx) {
  try {
    const telegramUserId =
      ctx.from?.id;

    if (!telegramUserId) {
      return;
    }

    await sendPendingReports(
      ctx,
      telegramUserId,
      0
    );
  } catch (error) {
    console.error(
      "Open quiz reports failed:",
      error
    );

    if (
      error.code ===
      "PERMISSION_DENIED"
    ) {
      await ctx.reply(
        "⛔ شما دسترسی مشاهده گزارش‌ها را ندارید."
      );

      return;
    }

    await ctx.reply(
      "❌ دریافت گزارش‌های سؤالات انجام نشد."
    );
  }
}

async function handleReportsFilter(ctx) {
  try {
    const telegramUserId =
      ctx.from?.id;

    if (!telegramUserId) {
      return;
    }

    await ctx.answerCbQuery();

    await requireReportViewPermission(
      telegramUserId
    );

    const rows =
      await quizReportService.countPendingReportsByReason(
        telegramUserId
      );

    const counts = {};

    for (const row of rows) {
      counts[row.reason] =
        Number(row.count || 0);
    }

    const total =
      await quizReportService.countPendingReports(
        telegramUserId
      );

    await ctx.reply(
      "🔎 فیلتر گزارش‌ها\n\n" +
        `📊 همه گزارش‌های در انتظار: ${total}\n\n` +
        "دلیل موردنظر را انتخاب کنید:",
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            `📊 همه (${total})`,
            "quiz_admin_reports_filter_select:ALL"
          ),
        ],
        [
          Markup.button.callback(
            `❌ جواب صحیح اشتباه است (${
              counts.WRONG_ANSWER || 0
            })`,
            "quiz_admin_reports_filter_select:WRONG_ANSWER"
          ),
        ],
        [
          Markup.button.callback(
            `❓ متن سؤال مشکل دارد (${
              counts.BAD_QUESTION || 0
            })`,
            "quiz_admin_reports_filter_select:BAD_QUESTION"
          ),
        ],
        [
          Markup.button.callback(
            `🅰️🅱️ گزینه‌ها مشکل دارند (${
              counts.BAD_OPTIONS || 0
            })`,
            "quiz_admin_reports_filter_select:BAD_OPTIONS"
          ),
        ],
        [
          Markup.button.callback(
            `🔄 سؤال تکراری است (${
              counts.DUPLICATE || 0
            })`,
            "quiz_admin_reports_filter_select:DUPLICATE"
          ),
        ],
        [
          Markup.button.callback(
            `⚠️ مبهم/غیرقابل‌اعتماد (${
              counts.UNRELIABLE || 0
            })`,
            "quiz_admin_reports_filter_select:UNRELIABLE"
          ),
        ],
        [
          Markup.button.callback(
            `📝 سایر (${
              counts.OTHER || 0
            })`,
            "quiz_admin_reports_filter_select:OTHER"
          ),
        ],
        [
          Markup.button.callback(
            "🔙 برگشت به گزارش‌ها",
            "quiz_admin_reports_all"
          ),
        ],
      ])
    );
  } catch (error) {
    console.error(
      "Quiz report filter failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "❌ دریافت فیلترها انجام نشد.",
        {
          show_alert: true,
        }
      );
    } catch {}
  }
}

async function handleReportView(
  ctx,
  reportId
) {
  try {
    const telegramUserId =
      ctx.from?.id;

    if (!telegramUserId) {
      return;
    }

    await ctx.answerCbQuery();

    const report =
      await quizReportService.getReportById(
        telegramUserId,
        reportId
      );

    if (!report) {
      await ctx.editMessageText(
        "❌ گزارش پیدا نشد."
      );

      return;
    }

    const reporter =
      report.username
        ? `@${report.username}`
        : report.telegram_user_id
          ? String(
              report.telegram_user_id
            )
          : "نامشخص";

    const text =
      "👀 مشاهده گزارش\n\n" +
      `📋 گزارش: ${report.id}\n` +
      `👤 گزارش‌دهنده: ${reporter}\n` +
      `⚠️ دلیل: ${formatReportReason(
        report.reason
      )}\n` +
      `📌 وضعیت گزارش: ${report.status}\n\n` +
      formatQuestion(report);

    await ctx.editMessageText(
      text,
      buildReportButtons(report)
    );
  } catch (error) {
    console.error(
      "View quiz report failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "❌ مشاهده گزارش انجام نشد.",
        {
          show_alert: true,
        }
      );
    } catch {}
  }
}

async function handleArchiveView(
  ctx,
  reportId,
  status
) {
  try {
    const telegramUserId =
      ctx.from?.id;

    if (!telegramUserId) {
      return;
    }

    await requireReportViewPermission(
      telegramUserId
    );

    await ctx.answerCbQuery();

    const report =
      await quizReportService.getReportById(
        telegramUserId,
        reportId
      );

    if (!report) {
      await ctx.editMessageText(
        "❌ گزارش پیدا نشد."
      );

      return;
    }

    const title =
      status === "REVIEWED"
        ? "📚 آرشیو بررسی‌شده"
        : "🗃 آرشیو بررسی‌نشده";

    const buttons = [];

    if (status === "UNREVIEWED") {
      buttons.push([
        Markup.button.callback(
          "✅ بررسی شد و انتقال به آرشیو بررسی‌شده",
          `quiz_admin_archive_review:${report.id}`
        ),
      ]);
    }

    if (status === "REVIEWED") {
      buttons.push([
        Markup.button.callback(
          "↩️ بازگرداندن به بررسی",
          `quiz_admin_archive_restore:${report.id}`
        ),
      ]);
    }

    buttons.push([
      Markup.button.callback(
        "🗑 حذف گزارش",
        `quiz_admin_archive_delete:${report.id}:${status}`
      ),
    ]);

    buttons.push([
      Markup.button.callback(
        "📂 بازگشت به آرشیو",
        `quiz_admin_archive:${status}:0`
      ),
    ]);

    buttons.push([
      Markup.button.callback(
        "📂 همه آرشیوها",
        "quiz_admin_reports_archive"
      ),
    ]);

    await ctx.editMessageText(
      buildArchiveReportText(
        report,
        title
      ),
      Markup.inlineKeyboard(
        buttons
      )
    );
  } catch (error) {
    console.error(
      "View quiz archive report failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "❌ مشاهده گزارش انجام نشد.",
        {
          show_alert: true,
        }
      );
    } catch {}
  }
}

async function handleArchiveReview(
  ctx,
  reportId
) {
  try {
    const telegramUserId =
      ctx.from?.id;

    if (!telegramUserId) {
      return;
    }

    await requireReportManagePermission(
      telegramUserId
    );

    await ctx.answerCbQuery();

    const result =
      await quizReportService.markReviewed(
        telegramUserId,
        reportId
      );

    if (!result) {
      await ctx.editMessageText(
        "ℹ️ گزارش پیدا نشد یا قبلاً بررسی شده است."
      );

      return;
    }

    await ctx.editMessageText(
      "✅ گزارش بررسی شد و به آرشیو بررسی‌شده منتقل شد.\n\n" +
        `📋 شناسه گزارش: ${reportId}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "📚 آرشیو بررسی‌شده",
            "quiz_admin_archive:REVIEWED:0"
          ),
        ],
        [
          Markup.button.callback(
            "🗃 آرشیو بررسی‌نشده",
            "quiz_admin_archive:UNREVIEWED:0"
          ),
        ],
        [
          Markup.button.callback(
            "📂 همه آرشیوها",
            "quiz_admin_reports_archive"
          ),
        ],
      ])
    );
  } catch (error) {
    console.error(
      "Review archived quiz report failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "❌ انتقال گزارش انجام نشد.",
        {
          show_alert: true,
        }
      );
    } catch {}
  }
}

async function handleArchiveRestore(
  ctx,
  reportId
) {
  try {
    const telegramUserId =
      ctx.from?.id;

    if (!telegramUserId) {
      return;
    }

    await requireReportManagePermission(
      telegramUserId
    );

    await ctx.answerCbQuery();

    const result =
      await quizReportService.restoreToPending(
        telegramUserId,
        reportId
      );

    if (!result) {
      await ctx.editMessageText(
        "ℹ️ گزارش پیدا نشد یا قابل بازگردانی نیست."
      );

      return;
    }

    await ctx.editMessageText(
      "↩️ گزارش به بررسی‌های در انتظار بازگردانده شد.\n\n" +
        `📋 شناسه گزارش: ${reportId}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "🚨 گزارش‌های در انتظار",
            "quiz_admin_reports_all"
          ),
        ],
        [
          Markup.button.callback(
            "📂 همه آرشیوها",
            "quiz_admin_reports_archive"
          ),
        ],
      ])
    );
  } catch (error) {
    console.error(
      "Restore archived quiz report failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "❌ بازگردانی گزارش انجام نشد.",
        {
          show_alert: true,
        }
      );
    } catch {}
  }
}

async function handleArchiveDelete(
  ctx,
  reportId,
  status
) {
  try {
    const telegramUserId =
      ctx.from?.id;

    if (!telegramUserId) {
      return;
    }

    await requireReportManagePermission(
      telegramUserId
    );

    await ctx.answerCbQuery();

    const deleted =
      await quizReportService.deleteReport(
        telegramUserId,
        reportId
      );

    if (!deleted) {
      await ctx.editMessageText(
        "ℹ️ گزارش پیدا نشد یا قبلاً حذف شده است.",
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "📂 آرشیوها",
              "quiz_admin_reports_archive"
            ),
          ],
        ])
      );

      return;
    }

    await ctx.editMessageText(
      "🗑 گزارش با موفقیت حذف شد.\n\n" +
        `📋 شناسه گزارش: ${reportId}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            status === "REVIEWED"
              ? "📚 ادامه آرشیو بررسی‌شده"
              : "🗃 ادامه آرشیو بررسی‌نشده",
            `quiz_admin_archive:${status}:0`
          ),
        ],
        [
          Markup.button.callback(
            "📂 همه آرشیوها",
            "quiz_admin_reports_archive"
          ),
        ],
      ])
    );
  } catch (error) {
    console.error(
      "Delete archived quiz report failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "❌ حذف گزارش انجام نشد.",
        {
          show_alert: true,
        }
      );
    } catch {}
  }
}

async function handleReportResolve(
  ctx,
  reportId,
  status
) {
  try {
    const telegramUserId =
      ctx.from?.id;

    if (!telegramUserId) {
      return;
    }

    await requireReportManagePermission(
      telegramUserId
    );

    const normalizedStatus =
      String(status || "")
        .trim()
        .toUpperCase();

    if (
      ![
        "RESOLVED",
        "REJECTED",
      ].includes(normalizedStatus)
    ) {
      await ctx.answerCbQuery(
        "❌ وضعیت نامعتبر است.",
        {
          show_alert: true,
        }
      );

      return;
    }

    await ctx.answerCbQuery();

    const result =
      await quizReportService.resolveReport(
        telegramUserId,
        reportId,
        normalizedStatus
      );

    if (!result) {
      await ctx.editMessageText(
        "ℹ️ این گزارش قبلاً بررسی شده یا وجود ندارد."
      );

      return;
    }

    const message =
      normalizedStatus === "RESOLVED"
        ? "✅ گزارش تأیید و به‌عنوان بررسی‌شده ثبت شد."
        : "❌ گزارش رد شد.";

    await ctx.editMessageText(
      message +
        `\n\n📋 شناسه گزارش: ${reportId}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "🚨 گزارش‌های بعدی",
            "quiz_admin_reports:0"
          ),
        ],
        [
          Markup.button.callback(
            "📂 آرشیو گزارش‌ها",
            "quiz_admin_reports_archive"
          ),
        ],
        [
          Markup.button.callback(
            "🔙 منوی مدیریت مسابقه",
            "quiz_admin_reports_back"
          ),
        ],
      ])
    );
  } catch (error) {
    console.error(
      "Resolve quiz report failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "❌ تغییر وضعیت گزارش انجام نشد.",
        {
          show_alert: true,
        }
      );
    } catch {}
  }
}

function createReportsHandler({
  bot,
  quizAdminMenu,
  startEditQuestion,
}) {
  bot.hears(
    "🚨 گزارش‌های سؤالات",
    handleReportsMenu
  );

  bot.action(
    "quiz_admin_reports_filter",
    handleReportsFilter
  );

  bot.action(
    "quiz_admin_reports_archive",
    async (ctx) => {
      try {
        const telegramUserId =
          ctx.from?.id;

        if (!telegramUserId) {
          return;
        }

        await ctx.answerCbQuery();

        await sendArchiveMenu(
          ctx,
          telegramUserId
        );
      } catch (error) {
        console.error(
          "Open quiz reports archive failed:",
          error
        );

        try {
          await ctx.answerCbQuery(
            "❌ دریافت آرشیوها انجام نشد.",
            {
              show_alert: true,
            }
          );
        } catch {}
      }
    }
  );

  bot.action(
    /^quiz_admin_archive:(REVIEWED|UNREVIEWED):(\d+)$/,
    async (ctx) => {
      try {
        const telegramUserId =
          ctx.from?.id;

        if (!telegramUserId) {
          return;
        }

        const status =
          ctx.match[1];

        const offset =
          Number(
            ctx.match[2]
          );

        await ctx.answerCbQuery();

        await sendArchiveReports(
          ctx,
          telegramUserId,
          status,
          offset
        );
      } catch (error) {
        console.error(
          "Quiz archive pagination failed:",
          error
        );

        try {
          await ctx.answerCbQuery(
            "❌ دریافت آرشیو انجام نشد.",
            {
              show_alert: true,
            }
          );
        } catch {}
      }
    }
  );

  bot.action(
    /^quiz_admin_archive_view:(\d+):(REVIEWED|UNREVIEWED)$/,
    async (ctx) => {
      await handleArchiveView(
        ctx,
        Number(
          ctx.match[1]
        ),
        ctx.match[2]
      );
    }
  );

  bot.action(
    /^quiz_admin_archive_review:(\d+)$/,
    async (ctx) => {
      await handleArchiveReview(
        ctx,
        Number(
          ctx.match[1]
        )
      );
    }
  );

  bot.action(
    /^quiz_admin_archive_restore:(\d+)$/,
    async (ctx) => {
      await handleArchiveRestore(
        ctx,
        Number(
          ctx.match[1]
        )
      );
    }
  );

  bot.action(
    /^quiz_admin_archive_delete:(\d+):(REVIEWED|UNREVIEWED)$/,
    async (ctx) => {
      await handleArchiveDelete(
        ctx,
        Number(
          ctx.match[1]
        ),
        ctx.match[2]
      );
    }
  );

  bot.action(
    "quiz_admin_reports_all",
    async (ctx) => {
      try {
        const telegramUserId =
          ctx.from?.id;

        if (!telegramUserId) {
          return;
        }

        await ctx.answerCbQuery();

        await sendPendingReports(
          ctx,
          telegramUserId,
          0,
          null
        );
      } catch (error) {
        console.error(
          "Show all quiz reports failed:",
          error
        );

        try {
          await ctx.answerCbQuery(
            "❌ دریافت گزارش‌ها انجام نشد.",
            {
              show_alert: true,
            }
          );
        } catch {}
      }
    }
  );

  bot.action(
    /^quiz_admin_reports_filter_select:(ALL|WRONG_ANSWER|BAD_QUESTION|BAD_OPTIONS|DUPLICATE|UNRELIABLE|OTHER)$/,
    async (ctx) => {
      try {
        const telegramUserId =
          ctx.from?.id;

        if (!telegramUserId) {
          return;
        }

        await ctx.answerCbQuery();

        const selected =
          ctx.match[1];

        await sendPendingReports(
          ctx,
          telegramUserId,
          0,
          selected === "ALL"
            ? null
            : selected
        );
      } catch (error) {
        console.error(
          "Select quiz report filter failed:",
          error
        );

        try {
          await ctx.answerCbQuery(
            "❌ اعمال فیلتر انجام نشد.",
            {
              show_alert: true,
            }
          );
        } catch {}
      }
    }
  );

  bot.action(
    /^quiz_admin_reports:(\d+)$/,
    async (ctx) => {
      try {
        const telegramUserId =
          ctx.from?.id;

        if (!telegramUserId) {
          return;
        }

        const offset =
          Number(
            ctx.match[1]
          );

        await ctx.answerCbQuery();

        const state =
          getState(telegramUserId);

        await sendPendingReports(
          ctx,
          telegramUserId,
          offset,
          state?.reason || null
        );
      } catch (error) {
        console.error(
          "Quiz admin reports pagination failed:",
          error
        );

        try {
          await ctx.answerCbQuery(
            "❌ دریافت گزارش‌ها انجام نشد.",
            {
              show_alert: true,
            }
          );
        } catch {}
      }
    }
  );

  bot.action(
    "quiz_admin_reports_back",
    async (ctx) => {
      try {
        await ctx.answerCbQuery();

        clearState(
          ctx.from?.id
        );

        await ctx.reply(
          "🧠 مدیریت مسابقه\n\n" +
            "بخش موردنظر را انتخاب کنید.",
          await quizAdminMenu(ctx)
        );
      } catch (error) {
        console.error(
          "Quiz admin reports back failed:",
          error
        );
      }
    }
  );

  bot.action(
    /^quiz_admin_report_view:(\d+)$/,
    async (ctx) => {
      await handleReportView(
        ctx,
        Number(
          ctx.match[1]
        )
      );
    }
  );

  bot.action(
    /^quiz_admin_report_edit:(\d+)$/,
    async (ctx) => {
      try {
        const telegramUserId =
          ctx.from?.id;

        if (!telegramUserId) {
          return;
        }

        await requireReportManagePermission(
          telegramUserId
        );

        const report =
          await quizReportService.getReportById(
            telegramUserId,
            Number(
              ctx.match[1]
            )
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

        await startEditQuestion(
          ctx,
          report.question_id,
          {
            fromReport: true,
            reportId: report.id,
          }
        );
      } catch (error) {
        console.error(
          "Start quiz report edit failed:",
          error
        );

        try {
          await ctx.answerCbQuery(
            "❌ شما دسترسی مدیریت گزارش‌ها را ندارید.",
            {
              show_alert: true,
            }
          );
        } catch {}
      }
    }
  );

  bot.action(
    /^quiz_admin_report_resolve:(\d+):(RESOLVED|REJECTED)$/,
    async (ctx) => {
      await handleReportResolve(
        ctx,
        Number(
          ctx.match[1]
        ),
        ctx.match[2]
      );
    }
  );
}

module.exports = {
  createReportsHandler,
  sendPendingReports,
};
