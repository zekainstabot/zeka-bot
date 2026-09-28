const {
  Markup,
} = require("telegraf");

const adminQuizService = require(
  "../services/admin-quiz.service"
);

const adminQuizStates = new Map();

const CANCEL_TEXT = "❌ لغو";

const quizAdminMenu = Markup.keyboard([
  ["➕ افزودن سؤال"],
  ["🔙 پنل مدیریت"],
]).resize();

const cancelMenu = Markup.keyboard([
  [CANCEL_TEXT],
]).resize();

function getState(userId) {
  return adminQuizStates.get(userId) || null;
}

function setState(userId, state) {
  adminQuizStates.set(userId, state);
}

function clearState(userId) {
  adminQuizStates.delete(userId);
}

async function startAddQuestion(ctx) {
  const telegramUserId = ctx.from?.id;

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
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return next();
  }

  const state =
    getState(telegramUserId);

  if (!state) {
    return next();
  }

  const text =
    typeof ctx.message?.text === "string"
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
          !["A", "B", "C", "D"].includes(
            correctOption
          )
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
          text === "-" ? null : text;

        state.step = "confirm";

        const data = state.data;

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
              data.explanation || "ندارد"
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
        if (text !== "✅ ثبت سؤال") {
          await ctx.reply(
            "برای ثبت سؤال روی «✅ ثبت سؤال» بزنید یا «❌ لغو» را انتخاب کنید."
          );

          return;
        }

        const data = state.data;

        const question =
          await adminQuizService.createQuestion({
            telegramUserId,
            languageCode: "fa",
            category: data.category,
            difficulty: data.difficulty,
            questionText: data.questionText,
            optionA: data.optionA,
            optionB: data.optionB,
            optionC: data.optionC,
            optionD: data.optionD,
            correctOption:
              data.correctOption,
            explanation:
              data.explanation,
          });

        clearState(telegramUserId);

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
        clearState(telegramUserId);

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

    clearState(telegramUserId);

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

  bot.on(
    "text",
    handleAdminQuizText
  );
}

module.exports = {
  createAdminQuizHandler,
};
