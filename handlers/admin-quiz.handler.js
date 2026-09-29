const {
  Markup,
} = require("telegraf");

const adminQuizService = require(
  "../services/admin-quiz.service"
);

const quizReportService = require(
  "../services/quiz-report.service"
);

const adminQuizStates = new Map();

const CANCEL_TEXT = "❌ لغو";

const quizAdminMenu = Markup.keyboard([
  ["➕ افزودن سؤال"],
  ["🚨 گزارش‌های سؤالات"],
  ["🔙 پنل مدیریت"],
]).resize();

const cancelMenu = Markup.keyboard([
  [CANCEL_TEXT],
]).resize();

function getState(userId) {
  return (
    adminQuizStates.get(userId) ||
    null
  );
}

function setState(userId, state) {
  adminQuizStates.set(
    userId,
    state
  );
}

function clearState(userId) {
  adminQuizStates.delete(userId);
}

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
    `📌 وضعیت: ${question.question_status || question.status || "نامشخص"}\n` +
    `💡 توضیح: ${question.explanation || "ندارد"}`
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

async function sendPendingReports(
  ctx,
  telegramUserId,
  offset = 0
) {
  await adminQuizService.requireQuizPermission(
    telegramUserId
  );

  const reports =
    await quizReportService.listPendingReports(
      telegramUserId,
      {
        limit: 1,
        offset,
      }
    );

  const total =
    await quizReportService.countPendingReports(
      telegramUserId
    );

  if (
    !reports ||
    reports.length === 0
  ) {
    await ctx.reply(
      "🚨 گزارش‌های سؤالات\n\n" +
        "✅ هیچ گزارش در انتظاری وجود ندارد.",
      quizAdminMenu
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

  if (offset > 0) {
    buttons.push([
      Markup.button.callback(
        "⬅️ قبلی",
        `quiz_admin_reports:${Math.max(
          0,
          offset - 1
        )}`
      ),
    ]);
  }

  if (offset + 1 < total) {
    buttons.push([
      Markup.button.callback(
        "➡️ بعدی",
        `quiz_admin_reports:${offset + 1}`
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
      "🔙 منوی مدیریت مسابقه",
      "quiz_admin_reports_back"
    ),
  ]);

  await ctx.reply(
    text +
      `\n\n📊 گزارش ${offset + 1} از ${total}`,
    Markup.inlineKeyboard(buttons)
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
        "⛔ شما دسترسی مدیریت گزارش‌های مسابقه را ندارید."
      );

      return;
    }

    await ctx.reply(
      "❌ دریافت گزارش‌های سؤالات انجام نشد."
    );
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

    if (
      normalizedStatus ===
      "RESOLVED"
    ) {
      await ctx.editMessageText(
        "✅ گزارش تأیید و به‌عنوان بررسی‌شده ثبت شد.\n\n" +
          `📋 شناسه گزارش: ${reportId}`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "🚨 گزارش‌های بعدی",
              "quiz_admin_reports:0"
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

    await ctx.editMessageText(
      "❌ گزارش رد شد.\n\n" +
        `📋 شناسه گزارش: ${reportId}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "🚨 گزارش‌های بعدی",
            "quiz_admin_reports:0"
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

async function handleReportEdit(
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

    await adminQuizService.requireQuizPermission(
      telegramUserId
    );

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

    await ctx.editMessageText(
      "✏️ اصلاح سؤال\n\n" +
        `🆔 سؤال: ${report.question_id}\n\n` +
        "سیستم ویرایش سؤال در مرحله بعد اضافه می‌شود.\n\n" +
        "فعلاً می‌توانی گزارش را تأیید یا رد کنی.",
      Markup.inlineKeyboard([
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
        [
          Markup.button.callback(
            "🔙 برگشت",
            `quiz_admin_report_view:${report.id}`
          ),
        ],
      ])
    );
  } catch (error) {
    console.error(
      "Edit quiz report failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "❌ باز کردن اصلاح سؤال انجام نشد.",
        {
          show_alert: true,
        }
      );
    } catch {}
  }
}

async function startAddQuestion(ctx) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  try {
    await adminQuizService.requireQuizPermission(
      telegramUserId
    );

    setState(telegramUserId, {
      step: "question",
      data: {},
    });

    await ctx.reply(
      "➕ افزودن سؤال مسابقه\n\n" +
        "📝 متن سؤال را ارسال کنید.\n\n" +
        "برای لغو، روی «❌ لغو» بزنید.",
      cancelMenu
    );
  } catch (error) {
    console.error(
      "Start admin quiz question failed:",
      error
    );

    if (
      error.code ===
      "PERMISSION_DENIED"
    ) {
      await ctx.reply(
        "⛔ شما دسترسی مدیریت سؤالات مسابقه را ندارید."
      );

      return;
    }

    await ctx.reply(
      "❌ شروع افزودن سؤال انجام نشد."
    );
  }
}

async function handleAdminQuizText(
  ctx,
  next
) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return next();
  }

  const state =
    getState(telegramUserId);

  if (!state) {
    return next();
  }

  const text =
    typeof ctx.message?.text ===
    "string"
      ? ctx.message.text.trim()
      : "";

  if (!text) {
    return;
  }

  if (
    text === CANCEL_TEXT ||
    text === "/cancel"
  ) {
    clearState(telegramUserId);

    await ctx.reply(
      "❌ افزودن سؤال لغو شد.",
      quizAdminMenu
    );

    return;
  }

  try {
    switch (state.step) {
      case "question": {
        state.data.questionText =
          text;

        state.step = "optionA";

        await ctx.reply(
          "🅰️ گزینه A را ارسال کنید.",
          cancelMenu
        );

        return;
      }

      case "optionA": {
        state.data.optionA =
          text;

        state.step = "optionB";

        await ctx.reply(
          "🅱️ گزینه B را ارسال کنید.",
          cancelMenu
        );

        return;
      }

      case "optionB": {
        state.data.optionB =
          text;

        state.step = "optionC";

        await ctx.reply(
          "©️ گزینه C را ارسال کنید.",
          cancelMenu
        );

        return;
      }

      case "optionC": {
        state.data.optionC =
          text;

        state.step = "optionD";

        await ctx.reply(
          "🅳 گزینه D را ارسال کنید.",
          cancelMenu
        );

        return;
      }

      case "optionD": {
        state.data.optionD =
          text;

        state.step = "correctOption";

        await ctx.reply(
          "✅ کدام گزینه پاسخ صحیح است؟",
          Markup.keyboard([
            ["A", "B"],
            ["C", "D"],
            [CANCEL_TEXT],
          ]).resize()
        );

        return;
      }

      case "correctOption": {
        const correctOption =
          text.toUpperCase();

        if (
          ![
            "A",
            "B",
            "C",
            "D",
          ].includes(correctOption)
        ) {
          await ctx.reply(
            "❌ فقط یکی از گزینه‌های A، B، C یا D را انتخاب کنید."
          );

          return;
        }

        state.data.correctOption =
          correctOption;

        state.step = "category";

        await ctx.reply(
          "🏷️ دسته‌بندی سؤال را ارسال کنید.\n\n" +
            "مثال: عمومی، فناوری، تاریخ، جغرافیا",
          cancelMenu
        );

        return;
      }

      case "category": {
        state.data.category =
          text;

        state.step = "difficulty";

        await ctx.reply(
          "🎯 سطح سختی سؤال را انتخاب کنید.",
          Markup.keyboard([
            ["EASY", "MEDIUM"],
            ["HARD"],
            [CANCEL_TEXT],
          ]).resize()
        );

        return;
      }

      case "difficulty": {
        const difficulty =
          text.toUpperCase();

        if (
          ![
            "EASY",
            "MEDIUM",
            "HARD",
          ].includes(difficulty)
        ) {
          await ctx.reply(
            "❌ سطح سختی باید یکی از این موارد باشد:\n\n" +
              "EASY\n" +
              "MEDIUM\n" +
              "HARD"
          );

          return;
        }

        state.data.difficulty =
          difficulty;

        state.step = "explanation";

        await ctx.reply(
          "💡 توضیح پاسخ را ارسال کنید.\n\n" +
            "اگر توضیح نمی‌خواهید، فقط «-» ارسال کنید.",
          cancelMenu
        );

        return;
      }

      case "explanation": {
        state.data.explanation =
          text === "-"
            ? null
            : text;

        state.step = "confirm";

        const data =
          state.data;

        await ctx.reply(
          "📋 پیش‌نمایش سؤال\n\n" +
            `❓ ${data.questionText}\n\n` +
            `🅰️ ${data.optionA}\n` +
            `🅱️ ${data.optionB}\n` +
            `©️ ${data.optionC}\n` +
            `🅳 ${data.optionD}\n\n` +
            `✅ پاسخ صحیح: ${data.correctOption}\n` +
            `🏷️ دسته‌بندی: ${data.category}\n` +
            `🎯 سختی: ${data.difficulty}\n` +
            `💡 توضیح: ${
              data.explanation ||
              "ندارد"
            }\n\n` +
            "آیا سؤال ثبت شود؟",
          Markup.keyboard([
            ["✅ ثبت سؤال"],
            ["❌ لغو"],
          ]).resize()
        );

        return;
      }

      case "confirm": {
        if (
          text !==
          "✅ ثبت سؤال"
        ) {
          await ctx.reply(
            "برای ثبت سؤال روی «✅ ثبت سؤال» بزنید یا «❌ لغو» را انتخاب کنید."
          );

          return;
        }

        const data =
          state.data;

        const question =
          await adminQuizService.createQuestion({
            telegramUserId,
            languageCode:
              "fa",
            category:
              data.category,
            difficulty:
              data.difficulty,
            questionText:
              data.questionText,
            optionA:
              data.optionA,
            optionB:
              data.optionB,
            optionC:
              data.optionC,
            optionD:
              data.optionD,
            correctOption:
              data.correctOption,
            explanation:
              data.explanation,
          });

        clearState(
          telegramUserId
        );

        const total =
          await adminQuizService.countActiveQuestions(
            telegramUserId
          );

        await ctx.reply(
          "✅ سؤال با موفقیت ثبت شد.\n\n" +
            `🆔 شناسه سؤال: ${question.id}\n` +
            `📊 تعداد سؤالات فعال: ${total}`,
          quizAdminMenu
        );

        return;
      }

      default: {
        clearState(
          telegramUserId
        );

        await ctx.reply(
          "⚠️ وضعیت افزودن سؤال نامعتبر بود و از ابتدا پاک شد.",
          quizAdminMenu
        );

        return;
      }
    }
  } catch (error) {
    console.error(
      "Admin quiz handler failed:",
      error
    );

    clearState(
      telegramUserId
    );

    await ctx.reply(
      "❌ هنگام ثبت سؤال خطایی رخ داد.\n\n" +
        "فرایند لغو شد.",
      quizAdminMenu
    );
  }
}

function createAdminQuizHandler(bot) {
  bot.hears(
    "➕ افزودن سؤال",
    startAddQuestion
  );

  bot.hears(
    "🚨 گزارش‌های سؤالات",
    handleReportsMenu
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
          Number(ctx.match[1]);

        await ctx.answerCbQuery();

        await sendPendingReports(
          ctx,
          telegramUserId,
          offset
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

        await ctx.reply(
          "🧠 مدیریت مسابقه\n\n" +
            "بخش موردنظر را انتخاب کنید.",
          quizAdminMenu
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
        Number(ctx.match[1])
      );
    }
  );

  bot.action(
    /^quiz_admin_report_edit:(\d+)$/,
    async (ctx) => {
      await handleReportEdit(
        ctx,
        Number(ctx.match[1])
      );
    }
  );

  bot.action(
    /^quiz_admin_report_resolve:(\d+):(RESOLVED|REJECTED)$/,
    async (ctx) => {
      await handleReportResolve(
        ctx,
        Number(ctx.match[1]),
        ctx.match[2]
      );
    }
  );

  bot.on(
    "text",
    handleAdminQuizText
  );
}

module.exports = {
  createAdminQuizHandler,
};
