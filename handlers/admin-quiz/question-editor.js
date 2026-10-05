const {
  Markup,
} = require("telegraf");

const adminQuizService = require(
  "../../services/admin-quiz.service"
);

const {
  setState,
} = require("./state");

const CANCEL_TEXT = "❌ لغو";

const cancelMenu = Markup.keyboard([
  [CANCEL_TEXT],
]).resize();

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

module.exports = {
  startDirectEditQuestion,
};
