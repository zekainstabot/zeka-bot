const {
  Markup,
} = require("telegraf");

const {
  getState,
  setState,
  clearState,
  getImportState,
  setImportState,
  clearImportState,
} = require("./admin-quiz/state");
const adminQuizService = require(
  "../services/admin-quiz.service"
);

const {
  importFromUrl,
} = require(
  "../services/admin-quiz-import.service"
);

const {
  createReportsHandler,
} = require(
  "./admin-quiz/reports.handler"
);

const CANCEL_TEXT = "❌ لغو";

const IMPORT_BUTTON = "📥 ورود سؤال از سایت";

const BANK_PAGE_SIZE = 5;

function importCancelMenu() {
  return Markup.keyboard([
    ["❌ لغو"],
  ]).resize();
}
const {
  quizAdminMenu,
} = require(
  "./admin-quiz/menu"
);
const cancelMenu = Markup.keyboard([
  [CANCEL_TEXT],
]).resize();

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

/* =========================================================
   QUESTION BANK
========================================================= */

function getBankState(
  telegramUserId
) {
  const state =
    getState(telegramUserId);

  if (
    state &&
    state.mode === "BANK"
  ) {
    return state;
  }

  return {
    mode: "BANK",
    offset: 0,
    status: "ACTIVE",
    search: "",
    categoryId: null,
  };
}

function buildBankButtons({
  questions,
  total,
  offset,
  status
}) {
  const buttons = [];

  for (const question of questions) {
    buttons.push([
      Markup.button.callback(
        `👀 ${String(
          question.question_text || ""
        ).slice(0, 45)}`,
        `quiz_admin_bank_view:${question.id}`
      ),
    ]);

    buttons.push([
      Markup.button.callback(
        "✏️ اصلاح",
        `quiz_admin_bank_edit:${question.id}`
      ),
      Markup.button.callback(
        question.status === "ACTIVE"
          ? "🔴 غیرفعال"
          : "🟢 فعال",
        `quiz_admin_bank_status:${question.id}:${question.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"}`
      ),
    ]);
  }

  const navigation = [];

  if (offset > 0) {
    navigation.push(
      Markup.button.callback(
        "⬅️ قبلی",
        `quiz_admin_bank:${Math.max(
          0,
          offset - BANK_PAGE_SIZE
        )}`
      )
    );
  }

  if (
    offset + questions.length <
    total
  ) {
    navigation.push(
      Markup.button.callback(
        "➡️ بعدی",
        `quiz_admin_bank:${
          offset + BANK_PAGE_SIZE
        }`
      )
    );
  }

  if (navigation.length > 0) {
    buttons.push(navigation);
  }

  buttons.push([
    Markup.button.callback(
      "🔎 جستجوی سؤال",
      "quiz_admin_bank_search"
    ),
  ]);

  buttons.push([
    Markup.button.callback(
      "🏷️ فیلتر دسته‌بندی",
      "quiz_admin_bank_category_filter"
    ),
  ]);

  buttons.push([
    Markup.button.callback(
      status === "ACTIVE"
        ? "📚 نمایش همه سؤالات"
        : "🟢 فقط سؤالات فعال",
      `quiz_admin_bank_filter:${
        status === "ACTIVE"
          ? "ALL"
          : "ACTIVE"
      }`
    ),
  ]);

  buttons.push([
    Markup.button.callback(
      "🔄 بروزرسانی",
      `quiz_admin_bank:${offset}`
    ),
  ]);

  buttons.push([
    Markup.button.callback(
      "🔙 منوی مدیریت مسابقه",
      "quiz_admin_bank_back"
    ),
  ]);

  return Markup.inlineKeyboard(
    buttons
  );
}

async function sendQuestionBank(
  ctx,
  telegramUserId,
  offset = 0
) {
  await adminQuizService.requireQuizPermission(
    telegramUserId
  );

  const state =
    getBankState(
      telegramUserId
    );

  const safeOffset =
    Math.max(
      0,
      Number(offset) || 0
    );

  const status =
    state.status || "ACTIVE";

  const search =
    state.search || "";

  const categoryId =
    state.categoryId || null;

  const questions =
    await adminQuizService.listQuestions(
      telegramUserId,
      {
        search,
        status,
        categoryId,
        limit: BANK_PAGE_SIZE,
        offset: safeOffset,
      }
    );

  const total =
    await adminQuizService.countQuestions(
      telegramUserId,
      {
        search,
        status,
        categoryId,
      }
    );

  state.mode = "BANK";
  state.offset = safeOffset;
  state.status = status;
  state.search = search;
  state.categoryId = categoryId;

  setState(
    telegramUserId,
    state
  );

  if (
    !questions ||
    questions.length === 0
  ) {
    const searchText =
      search
        ? `\n\n🔎 جستجو: ${search}`
        : "";

    const text =
      "📚 بانک سؤالات\n\n" +
      "❌ هیچ سؤالی با این فیلتر پیدا نشد." +
      searchText;

    const buttons =
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "🔎 جستجوی سؤال",
            "quiz_admin_bank_search"
          ),
        ],
        [
          Markup.button.callback(
            "🔄 نمایش سؤالات فعال",
            "quiz_admin_bank_filter:ACTIVE"
          ),
        ],
        [
          Markup.button.callback(
            "🔙 منوی مدیریت مسابقه",
            "quiz_admin_bank_back"
          ),
        ],
      ]);

    if (
      ctx.callbackQuery &&
      ctx.callbackQuery.message
    ) {
      await ctx.editMessageText(
        text,
        buttons
      );
    } else {
      await ctx.reply(
        text,
        buttons
      );
    }

    return;
  }

  let text =
    "📚 بانک سؤالات\n\n";

  text +=
    `📊 تعداد: ${total}\n`;

  text +=
    `📌 فیلتر: ${
      status === "ACTIVE"
        ? "فعال"
        : status === "INACTIVE"
          ? "غیرفعال"
          : "همه"
    }\n`;

  if (search) {
    text +=
      `🔎 جستجو: ${search}\n`;
  }

  text +=
    `📄 نمایش ${safeOffset + 1} تا ${
      Math.min(
        safeOffset +
          questions.length,
        total
      )
    } از ${total}\n\n`;

  for (
    let i = 0;
    i < questions.length;
    i++
  ) {
    const question =
      questions[i];

    text +=
      `${i + 1}. 🆔 ${
        question.id
      }\n`;

    text +=
      `❓ ${
        String(
          question.question_text || ""
        ).slice(0, 100)
      }\n`;

    text +=
      `📌 ${
        question.status ===
        "ACTIVE"
          ? "🟢 فعال"
          : "🔴 غیرفعال"
      }`;

    text +=
      ` | 🎯 ${
        question.difficulty ||
        "نامشخص"
      }\n\n`;
  }

  const buttons =
    buildBankButtons({
      questions,
      total,
      offset: safeOffset,
      status,
    });

  if (
    ctx.callbackQuery &&
    ctx.callbackQuery.message
  ) {
    await ctx.editMessageText(
      text,
      buttons
    );
  } else {
    await ctx.reply(
      text,
      buttons
    );
  }
}

async function handleQuestionBankMenu(
  ctx
) {
  try {
    const telegramUserId =
      ctx.from?.id;

    if (!telegramUserId) {
      return;
    }

    await adminQuizService.requireQuizPermission(
      telegramUserId
    );

    setState(
      telegramUserId,
      {
        mode: "BANK",
        offset: 0,
        status: "ACTIVE",
        search: "",
      }
    );

    await sendQuestionBank(
      ctx,
      telegramUserId,
      0
    );
  } catch (error) {
    console.error(
      "Open quiz question bank failed:",
      error
    );

    if (
      error.code ===
      "PERMISSION_DENIED"
    ) {
      await ctx.reply(
        "⛔ شما دسترسی مدیریت بانک سؤالات را ندارید."
      );

      return;
    }

    await ctx.reply(
      "❌ باز کردن بانک سؤالات انجام نشد."
    );
  }
}

async function handleBankSearchStart(
  ctx
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

    setState(
      telegramUserId,
      {
        mode: "BANK_SEARCH",
        offset: 0,
        status: "ACTIVE",
        search: "",
      }
    );

    await ctx.reply(
      "🔎 جستجوی سؤال\n\n" +
        "متن سؤال، بخشی از سؤال یا شناسه سؤال را ارسال کنید.\n\n" +
        "مثال:\n" +
        "تهران\n" +
        "یا\n" +
        "125\n\n" +
        "برای لغو، «❌ لغو» را بزنید.",
      cancelMenu
    );
  } catch (error) {
    console.error(
      "Start quiz bank search failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "❌ شروع جستجو انجام نشد.",
        {
          show_alert: true,
        }
      );
    } catch {}
  }
}

async function handleBankSearchText(
  ctx,
  telegramUserId,
  text
) {
  await adminQuizService.requireQuizPermission(
    telegramUserId
  );

  setState(
    telegramUserId,
    {
      mode: "BANK",
      offset: 0,
      status: "ACTIVE",
      search: text,
    }
  );

  await sendQuestionBank(
    ctx,
    telegramUserId,
    0
  );
}

async function handleBankFilter(
  ctx,
  filter
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

    const state =
      getBankState(
        telegramUserId
      );

    state.mode = "BANK";
    state.offset = 0;
    state.status =
      filter === "ALL"
        ? "ALL"
        : "ACTIVE";

    setState(
      telegramUserId,
      state
    );

    await sendQuestionBank(
      ctx,
      telegramUserId,
      0
    );
  } catch (error) {
    console.error(
      "Quiz bank filter failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "❌ تغییر فیلتر انجام نشد.",
        {
          show_alert: true,
        }
      );
    } catch {}
  }
}

async function handleBankView(
  ctx,
  questionId
) {
  try {
    const telegramUserId =
      ctx.from?.id;

    if (!telegramUserId) {
      return;
    }

    await ctx.answerCbQuery();

    const question =
      await adminQuizService.getQuestionById(
        telegramUserId,
        questionId
      );

    if (!question) {
      await ctx.editMessageText(
        "❌ سؤال پیدا نشد."
      );

      return;
    }

    const text =
      "👀 مشاهده سؤال\n\n" +
      formatQuestion(
        question
      );

    await ctx.editMessageText(
      text,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "✏️ اصلاح سؤال",
            `quiz_admin_bank_edit:${question.id}`
          ),
        ],
        [
          Markup.button.callback(
            question.status ===
              "ACTIVE"
              ? "🔴 غیرفعال کردن"
              : "🟢 فعال کردن",
            `quiz_admin_bank_status:${question.id}:${
              question.status ===
              "ACTIVE"
                ? "INACTIVE"
                : "ACTIVE"
            }`
          ),
        ],
        [
          Markup.button.callback(
            "🔙 بانک سؤالات",
            "quiz_admin_bank_back_list"
          ),
        ],
      ])
    );
  } catch (error) {
    console.error(
      "View quiz bank question failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "❌ مشاهده سؤال انجام نشد.",
        {
          show_alert: true,
        }
      );
    } catch {}
  }
}

async function handleBankStatus(
  ctx,
  questionId,
  status
) {
  try {
    const telegramUserId =
      ctx.from?.id;

    if (!telegramUserId) {
      return;
    }

    await ctx.answerCbQuery();

    const normalizedStatus =
      String(status || "")
        .trim()
        .toUpperCase();

    if (
      ![
        "ACTIVE",
        "INACTIVE",
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

    const updated =
      await adminQuizService.updateQuestionStatus({
        telegramUserId,
        questionId,
        status:
          normalizedStatus,
      });

    if (!updated) {
      await ctx.editMessageText(
        "❌ تغییر وضعیت سؤال انجام نشد."
      );

      return;
    }

    await ctx.editMessageText(
      normalizedStatus ===
        "ACTIVE"
        ? "🟢 سؤال فعال شد."
        : "🔴 سؤال غیرفعال شد.",
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "👀 مشاهده سؤال",
            `quiz_admin_bank_view:${questionId}`
          ),
        ],
        [
          Markup.button.callback(
            "🔙 بانک سؤالات",
            "quiz_admin_bank_back_list"
          ),
        ],
      ])
    );
  } catch (error) {
    console.error(
      "Change quiz question status failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "❌ تغییر وضعیت سؤال انجام نشد.",
        {
          show_alert: true,
        }
      );
    } catch {}
  }
}

/* =========================================================
   DIRECT QUESTION EDIT
========================================================= */

async function startDirectEditQuestion(
  ctx,
  questionId,
  options = {}
) {
  try {
    const telegramUserId =
      ctx.from?.id;

    if (!telegramUserId) {
      return;
    }

    await ctx.answerCbQuery();

    const fromReport =
      options.fromReport === true;

    const question =
      fromReport
        ? await adminQuizService.getQuestionByIdForReport(
            telegramUserId,
            questionId
          )
        : await adminQuizService.getQuestionById(
            telegramUserId,
            questionId
          );

    if (!question) {
      await ctx.editMessageText(
        "❌ سؤال پیدا نشد."
      );

      return;
    }

    setState(
      telegramUserId,
      {
        mode: fromReport
          ? "EDIT_REPORT"
          : "EDIT_DIRECT",
        step: "question",
        questionId:
          question.id,
        reportId:
          options.reportId || null,
        data: {
          questionText:
            question.question_text,
          optionA:
            question.option_a,
          optionB:
            question.option_b,
          optionC:
            question.option_c,
          optionD:
            question.option_d,
          correctOption:
            question.correct_option,
          category:
            question.category || "",
          difficulty:
            question.difficulty ||
            "MEDIUM",
          explanation:
            question.explanation ||
            null,
        },
      }
    );

    await ctx.reply(
      (
        fromReport
          ? "✏️ اصلاح سؤال از طریق گزارش"
          : "✏️ اصلاح مستقیم سؤال"
      ) +
        "\n\n" +
        `🆔 شناسه سؤال: ${question.id}\n\n` +
        "📝 متن جدید سؤال را ارسال کنید.\n\n" +
        "مقدار فعلی:\n" +
        `${question.question_text}\n\n` +
        "برای لغو، «❌ لغو» را بزنید.",
      cancelMenu
    );
  } catch (error) {
    console.error(
      "Start quiz question edit failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "❌ شروع اصلاح سؤال انجام نشد.",
        {
          show_alert: true,
        }
      );
    } catch {}
  }
}
async function startAddQuestion(
  ctx
) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  try {
    await adminQuizService.requireQuizPermission(
      telegramUserId
    );

    setState(
      telegramUserId,
      {
        mode: "ADD",
        step: "question",
        data: {},
      }
    );

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
        await quizAdminMenu(ctx)
      );

      return;
    }

    default: {
      clearState(
        telegramUserId
      );

      await ctx.reply(
        "⚠️ وضعیت افزودن سؤال نامعتبر بود و از ابتدا پاک شد.",
        await quizAdminMenu(ctx)
      );

      return;
    }
  }
}

/* =========================================================
   EDIT QUESTION
========================================================= */

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

      const mode =
        state.mode;

      const reportId =
        state.reportId;

      clearState(
        telegramUserId
      );

      if (!updated) {
        await ctx.reply(
          "❌ سؤال پیدا نشد یا اصلاحات ذخیره نشد.",
          await quizAdminMenu(ctx)
        );

        return;
      }

      if (
        mode ===
        "EDIT_DIRECT"
      ) {
        await ctx.reply(
          "✅ سؤال با موفقیت اصلاح شد.\n\n" +
            `🆔 شناسه سؤال: ${updated.id}`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "👀 مشاهده سؤال",
                `quiz_admin_bank_view:${updated.id}`
              ),
            ],
            [
              Markup.button.callback(
                "🔙 بانک سؤالات",
                "quiz_admin_bank_back_list"
              ),
            ],
          ])
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
        await quizAdminMenu(ctx)
      );

      return;
    }
  }
}

/* =========================================================
   TEXT STATE HANDLER
========================================================= */

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
      state.mode === "EDIT" ||
      state.mode === "EDIT_DIRECT";

    const wasSearching =
      state.mode ===
      "BANK_SEARCH";

    clearState(
      telegramUserId
    );

    if (wasSearching) {
      await ctx.reply(
        "❌ جستجو لغو شد.",
        await quizAdminMenu(ctx)
      );

      return;
    }

    await ctx.reply(
      wasEditing
        ? "❌ اصلاح سؤال لغو شد."
        : "❌ افزودن سؤال لغو شد.",
      await quizAdminMenu(ctx)
    );

    return;
  }

  try {
    if (
      state.mode ===
      "BANK_SEARCH"
    ) {
      await handleBankSearchText(
        ctx,
        telegramUserId,
        text
      );

      return;
    }

    if (
      state.mode ===
        "EDIT" ||
      state.mode ===
        "EDIT_DIRECT"
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
      await quizAdminMenu(ctx)
    );
  }
}

/* =========================================================
   HANDLER REGISTRATION
========================================================= */

async function handleImportQuestionsMenu(
  ctx
) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  try {
    await adminQuizService.requireQuizPermission(
      telegramUserId
    );
  } catch {
    await ctx.reply(
      "⛔ فقط Admin به این بخش دسترسی دارد."
    );

    return;
  }

  setImportState(
    telegramUserId,
    {
      step: "URL",
      createdAt: Date.now(),
    }
  );

  await ctx.reply(
    "📥 ورود سؤال از سایت\n\n" +
      "لینک صفحه‌ای که سؤال‌ها داخل آن قرار دارند را ارسال کن.\n\n" +
      "مثال:\n" +
      "https://example.com/questions\n\n" +
      "⏱️ تا 10 دقیقه فرصت داری.",
    importCancelMenu()
  );
}

async function handleImportQuestionsText(
  ctx,
  next
) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return next();
  }

  const state =
    getImportState(
      telegramUserId
    );

  if (!state) {
    return next();
  }

  const text =
    String(
      ctx.message?.text || ""
    ).trim();

  if (!text) {
    return;
  }

  if (
    text === "❌ لغو" ||
    text === "/cancel"
  ) {
    clearImportState(
      telegramUserId
    );

    await ctx.reply(
      "❌ ورود سؤال‌ها لغو شد.",
      await quizAdminMenu(ctx)
    );

    return;
  }

  if (
    Date.now() -
      state.createdAt >
    10 * 60 * 1000
  ) {
    clearImportState(
      telegramUserId
    );

    await ctx.reply(
      "⏱️ زمان ورود سؤال‌ها تمام شده است.",
      await quizAdminMenu(ctx)
    );

    return;
  }

  try {
    await adminQuizService.requireQuizPermission(
      telegramUserId
    );
  } catch {
    clearImportState(
      telegramUserId
    );

    await ctx.reply(
      "⛔ دسترسی شما به این بخش وجود ندارد."
    );

    return;
  }

  if (
    !/^https?:\/\//i.test(text)
  ) {
    await ctx.reply(
      "❌ لینک معتبر نیست.\n\n" +
        "لینک باید با http:// یا https:// شروع شود.",
      importCancelMenu()
    );

    return;
  }

  await ctx.reply(
    "⏳ در حال بررسی صفحه و استخراج سؤال‌ها..."
  );

  try {
    const result =
      await importFromUrl(
        text
      );

    clearImportState(
      telegramUserId
    );

    if (
      !result.total
    ) {
      await ctx.reply(
        "❌ هیچ سؤال چهارگزینه‌ای قابل استخراج پیدا نشد.\n\n" +
          "ممکن است ساختار این سایت با فرمت فعلی سازگار نباشد.",
        await quizAdminMenu(ctx)
      );

      return;
    }

    const preview =
      result.questions
        .slice(0, 5)
        .map(
          (question, index) => {
            const options =
              question.options
                .map(
                  (
                    option,
                    optionIndex
                  ) =>
                    `${String.fromCharCode(
                      65 +
                        optionIndex
                    )}) ${option}`
                )
                .join("\n");

            const answer =
              question.correctOption ===
              null
                ? "نامشخص"
                : String.fromCharCode(
                    65 +
                      question.correctOption
                  );

            return (
              `${index + 1}. ${question.question}\n\n` +
              `${options}\n\n` +
              `✅ پاسخ استخراج‌شده: ${answer}`
            );
          }
        )
        .join(
          "\n\n────────────\n\n"
        );

    await ctx.reply(
      `📥 نتیجه استخراج\n\n` +
        `🔢 تعداد سؤال پیدا‌شده: ${result.total}\n` +
        `🔗 منبع: ${result.url}\n\n` +
        `📋 پیش‌نمایش ۵ سؤال اول:\n\n` +
        preview +
        `\n\n⚠️ فعلاً هیچ سؤالی وارد بانک نشده است.`,
      await quizAdminMenu(ctx)
    );
  } catch (error) {
    console.error(
      "Quiz import failed:",
      error
    );

    clearImportState(
      telegramUserId
    );

    await ctx.reply(
      "❌ استخراج سؤال‌ها انجام نشد.\n\n" +
        `خطا: ${
          error.message ||
          "خطای نامشخص"
        }`,
      await quizAdminMenu(ctx)
    );
  }
}

function createAdminQuizHandler(
  bot
) {
  createReportsHandler({
  bot,
  quizAdminMenu,
  startEditQuestion:
    startDirectEditQuestion,
});

  bot.hears(
    "➕ افزودن سؤال",
    startAddQuestion
  );

  bot.hears(
    "📚 بانک سؤالات",
    handleQuestionBankMenu
  );

  bot.hears(
  IMPORT_BUTTON,
  handleImportQuestionsMenu
);

  bot.action(
    /^quiz_admin_bank:(\d+)$/,
    async (ctx) => {
      try {
        const telegramUserId =
          ctx.from?.id;

        if (!telegramUserId) {
          return;
        }

        await ctx.answerCbQuery();

        await sendQuestionBank(
          ctx,
          telegramUserId,
          Number(
            ctx.match[1]
          )
        );
      } catch (error) {
        console.error(
          "Quiz bank pagination failed:",
          error
        );

        try {
          await ctx.answerCbQuery(
            "❌ دریافت بانک سؤالات انجام نشد.",
            {
              show_alert: true,
            }
          );
        } catch {}
      }
    }
  );

  bot.action(
    "quiz_admin_bank_search",
    handleBankSearchStart
  );

  bot.action(
    /^quiz_admin_bank_filter:(ACTIVE|ALL)$/,
    async (ctx) => {
      await handleBankFilter(
        ctx,
        ctx.match[1]
      );
    }
  );

  bot.action(
    "quiz_admin_bank_category_filter",
    async (ctx) => {
      try {
        await ctx.answerCbQuery();

        const telegramUserId =
          ctx.from.id;

        const categories =
          await adminQuizService.listCategories(
            telegramUserId
          );

        if (
          !categories ||
          categories.length === 0
        ) {
          await ctx.reply(
            "📚 هیچ دسته‌بندی‌ای پیدا نشد."
          );

          return;
        }

        const buttons =
          categories.map(
            (category) => [
              Markup.button.callback(
                `🏷️ ${category.name_fa}`,
                `quiz_admin_bank_category:${category.id}`
              ),
            ]
          );

        buttons.push([
          Markup.button.callback(
            "❌ حذف فیلتر دسته‌بندی",
            "quiz_admin_bank_category:CLEAR"
          ),
        ]);

        buttons.push([
          Markup.button.callback(
            "🔙 برگشت",
            "quiz_admin_bank_back"
          ),
        ]);

        await ctx.reply(
          "🏷️ دسته‌بندی را انتخاب کن:",
          Markup.inlineKeyboard(
            buttons
          )
        );
      } catch (error) {
        console.error(
          "quiz category filter error:",
          error
        );

        await ctx.reply(
          "❌ دریافت دسته‌بندی‌ها انجام نشد."
        );
      }
    }
  );

  bot.action(
    /^quiz_admin_bank_category:(.+)$/,
    async (ctx) => {
      try {
        await ctx.answerCbQuery();

        const telegramUserId =
          ctx.from.id;

        const selectedCategory =
          ctx.match[1];

        const state =
          getBankState(
            telegramUserId
          );

        state.categoryId =
          selectedCategory ===
          "CLEAR"
            ? null
            : Number(
                selectedCategory
              );

        state.offset = 0;

        setState(
          telegramUserId,
          state
        );

        await sendQuestionBank(
          ctx,
          telegramUserId,
          0
        );
      } catch (error) {
        console.error(
          "quiz category select error:",
          error
        );

        await ctx.reply(
          "❌ اعمال فیلتر دسته‌بندی انجام نشد."
        );
      }
    }
  );

  bot.action(
    /^quiz_admin_bank_view:(\d+)$/,
    async (ctx) => {
      await handleBankView(
        ctx,
        Number(
          ctx.match[1]
        )
      );
    }
  );

  bot.action(
    /^quiz_admin_bank_edit:(\d+)$/,
    async (ctx) => {
      await startDirectEditQuestion(
        ctx,
        Number(
          ctx.match[1]
        )
      );
    }
  );

  bot.action(
    /^quiz_admin_bank_status:(\d+):(ACTIVE|INACTIVE)$/,
    async (ctx) => {
      await handleBankStatus(
        ctx,
        Number(
          ctx.match[1]
        ),
        ctx.match[2]
      );
    }
  );

  bot.action(
    "quiz_admin_bank_back_list",
    async (ctx) => {
      try {
        const telegramUserId =
          ctx.from?.id;

        if (!telegramUserId) {
          return;
        }

        await ctx.answerCbQuery();

        const state =
          getBankState(
            telegramUserId
          );

        await sendQuestionBank(
          ctx,
          telegramUserId,
          state.offset || 0
        );
      } catch (error) {
        console.error(
          "Back to quiz bank failed:",
          error
        );
      }
    }
  );

  bot.action(
    "quiz_admin_bank_back",
    async (ctx) => {
      try {
        const telegramUserId =
          ctx.from?.id;

        if (!telegramUserId) {
          return;
        }

        await ctx.answerCbQuery();

        clearState(
          telegramUserId
        );

        await ctx.reply(
  "🧠 مدیریت مسابقه\n\n" +
    "بخش موردنظر را انتخاب کنید.",
  await quizAdminMenu(ctx)
);
      } catch (error) {
        console.error(
          "Quiz bank back failed:",
          error
        );
      }
    }
  );

  bot.on(
  "text",
  handleImportQuestionsText
);

bot.on(
  "text",
  handleAdminQuizText
);
}

module.exports = {
  createAdminQuizHandler,
};
