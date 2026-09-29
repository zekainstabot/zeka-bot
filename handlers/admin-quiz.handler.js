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

async function startEditQuestion(
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

    if (
      report.status !==
      "PENDING"
    ) {
      await ctx.editMessageText(
        "ℹ️ این گزارش قبلاً بررسی شده و دیگر قابل ویرایش از این بخش نیست."
      );

      return;
    }

    setState(telegramUserId, {
      mode: "EDIT",
      step: "question",
      reportId: report.id,
      questionId:
        report.question_id,
      data: {
        questionText:
          report.question_text,
        optionA:
          report.option_a,
        optionB:
          report.option_b,
        optionC:
          report.option_c,
        optionD:
          report.option_d,
        correctOption:
          report.correct_option,
        category:
          report.category || "",
        difficulty:
          report.difficulty || "MEDIUM",
        explanation:
          report.explanation || null,
      },
    });

    await ctx.reply(
      "✏️ اصلاح سؤال\n\n" +
        `🆔 شناسه سؤال: ${report.question_id}\n\n` +
        "📝 متن جدید سؤال را ارسال کنید.\n\n" +
        "مقدار فعلی:\n" +
        `${report.question_text}\n\n` +
        "برای لغو، «❌ لغو» را بزنید.",
      cancelMenu
    );
  } catch (error) {
    console.error(
      "Start edit quiz question failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "❌ شروع ویرایش سؤال انجام نشد.",
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
      mode: "ADD",
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

async function handleAddQuestionStep(
  ctx,
  telegramUserId,
  state,
  text
) {
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

      state.step =
        "correctOption";

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
}

async function handleEditQuestionStep(
  ctx,
  telegramUserId,
  state,
  text
) {
  switch (state.step) {
    case "question": {
      state.data.questionText =
        text;

      state.step = "optionA";

      await ctx.reply(
        "🅰️ گزینه A جدید را ارسال کنید.\n\n" +
          `مقدار فعلی:\n${state.data.optionA}`,
        cancelMenu
      );

      return;
    }

    case "optionA": {
      state.data.optionA =
        text;

      state.step = "optionB";

      await ctx.reply(
        "🅱️ گزینه B جدید را ارسال کنید.\n\n" +
          `مقدار فعلی:\n${state.data.optionB}`,
        cancelMenu
      );

      return;
    }

    case "optionB": {
      state.data.optionB =
        text;

      state.step = "optionC";

      await ctx.reply(
        "©️ گزینه C جدید را ارسال کنید.\n\n" +
          `مقدار فعلی:\n${state.data.optionC}`,
        cancelMenu
      );

      return;
    }

    case "optionC": {
      state.data.optionC =
        text;

      state.step = "optionD";

      await ctx.reply(
        "🅳 گزینه D جدید را ارسال کنید.\n\n" +
          `مقدار فعلی:\n${state.data.optionD}`,
        cancelMenu
      );

      return;
    }

    case "optionD": {
      state.data.optionD =
        text;

      state.step =
        "correctOption";

      await ctx.reply(
        "✅ پاسخ صحیح را انتخاب کنید.\n\n" +
          `مقدار فعلی: ${state.data.correctOption}`,
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
          "❌ فقط A، B، C یا D را انتخاب کنید."
        );

        return;
      }

      state.data.correctOption =
        correctOption;

      state.step = "category";

      await ctx.reply(
        "🏷️ دسته‌بندی جدید را ارسال کنید.\n\n" +
          `مقدار فعلی: ${state.data.category}`,
        cancelMenu
      );

      return;
    }

    case "category": {
      state.data.category =
        text;

      state.step = "difficulty";

      await ctx.reply(
        "🎯 سطح سختی جدید را انتخاب کنید.\n\n" +
          `مقدار فعلی: ${state.data.difficulty}`,
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
        "💡 توضیح جدید را ارسال کنید.\n\n" +
          "برای حذف توضیح، «-» بفرستید.\n\n" +
          `مقدار فعلی: ${
            state.data.explanation ||
            "ندارد"
          }`,
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
        "📋 پیش‌نمایش اصلاحات\n\n" +
          `🆔 سؤال: ${state.questionId}\n\n` +
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
          "آیا این اصلاحات ذخیره شوند؟",
        Markup.keyboard([
          ["💾 ذخیره اصلاحات"],
          ["❌ لغو"],
        ]).resize()
      );

      return;
    }

    case "confirm": {
      if (
        text !==
        "💾 ذخیره اصلاحات"
      ) {
        await ctx.reply(
          "برای ذخیره روی «💾 ذخیره اصلاحات» بزنید یا «❌ لغو» را انتخاب کنید."
        );

        return;
      }

      const data =
        state.data;

      const updated =
        await adminQuizService.updateQuestion({
          telegramUserId,
          questionId:
            state.questionId,
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

      const reportId =
        state.reportId;

      clearState(
        telegramUserId
      );

      if (!updated) {
        await ctx.reply(
          "❌ سؤال پیدا نشد یا اصلاحات ذخیره نشد.",
          quizAdminMenu
        );

        return;
      }

      await ctx.reply(
        "✅ سؤال با موفقیت اصلاح شد.\n\n" +
          `🆔 سؤال: ${updated.id}\n` +
          `📋 گزارش مرتبط: ${reportId}\n\n` +
          "⚠️ گزارش هنوز بسته نشده است.",
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "✅ بستن گزارش",
              `quiz_admin_report_resolve:${reportId}:RESOLVED`
            ),
          ],
          [
            Markup.button.callback(
              "👀 مشاهده گزارش",
              `quiz_admin_report_view:${reportId}`
            ),
          ],
          [
            Markup.button.callback(
              "🚨 گزارش‌های بعدی",
              "quiz_admin_reports:0"
            ),
          ],
        ])
      );

      return;
    }

    default: {
      clearState(
        telegramUserId
      );

      await ctx.reply(
        "⚠️ وضعیت ویرایش نامعتبر بود و فرایند لغو شد.",
        quizAdminMenu
      );

      return;
    }
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
    const wasEditing =
      state.mode === "EDIT";

    clearState(
      telegramUserId
    );

    await ctx.reply(
      wasEditing
        ? "❌ اصلاح سؤال لغو شد."
        : "❌ افزودن سؤال لغو شد.",
      quizAdminMenu
    );

    return;
  }

  try {
    if (
      state.mode ===
      "EDIT"
    ) {
      await handleEditQuestionStep(
        ctx,
        telegramUserId,
        state,
        text
      );

      return;
    }

    await handleAddQuestionStep(
      ctx,
      telegramUserId,
      state,
      text
    );
  } catch (error) {
    console.error(
      "Admin quiz handler failed:",
      error
    );

    clearState(
      telegramUserId
    );

    await ctx.reply(
      "❌ هنگام پردازش سؤال خطایی رخ داد.\n\n" +
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
      await startEditQuestion(
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
