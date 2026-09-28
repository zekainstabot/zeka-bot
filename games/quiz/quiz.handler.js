const { Markup } = require("telegraf");

const {
  startQuiz,
  prepareNextQuestion,
  registerPoll,
  processPollAnswer,
  findActiveQuizByUser,
} = require("./quiz.service");

const gameService = require("../game.service");

const quizTimers = new Map();

function clearQuizTimer(sessionId) {
  const timer = quizTimers.get(sessionId);

  if (timer) {
    clearTimeout(timer);
    quizTimers.delete(sessionId);
  }
}

async function cancelUserActiveQuiz(userId) {
  const session = await findActiveQuizByUser(userId);

  if (!session) {
    return null;
  }

  clearQuizTimer(session.id);

  return gameService.cancelGame(session.id);
}

function getCorrectOptionIndex(question) {
  const options = [
    question.option_a,
    question.option_b,
    question.option_c,
    question.option_d,
  ].filter(
    (option) =>
      option !== null &&
      option !== undefined &&
      option !== ""
  );

  const correctIndex = Number(question.correct_option);

  if (
    !Number.isInteger(correctIndex) ||
    correctIndex < 0 ||
    correctIndex >= options.length
  ) {
    throw new Error("Invalid quiz correct option index");
  }

  return correctIndex;
}

function scheduleQuizTimeout(
  bot,
  sessionId,
  pollId,
  seconds,
  processTimeout
) {
  clearQuizTimer(sessionId);

  const timeoutMs =
    Math.max(1, Number(seconds) || 10) * 1000;

  const timer = setTimeout(async () => {
    quizTimers.delete(sessionId);

    try {
      const result = await processTimeout({
        sessionId,
        pollId,
      });

      if (!result || !result.handled) {
        return;
      }

      if (result.finished) {
        await sendQuizFinishedMessage(
          bot,
          sessionId,
          result
        );
        return;
      }

      const telegramUserId =
        await getTelegramUserIdByUserId(
          bot,
          result.userId
        );

      if (!telegramUserId) {
        return;
      }

      await bot.telegram.sendMessage(
        telegramUserId,
        "⏰ زمان این سؤال تمام شد.\n\n" +
          "❌ پاسخی ثبت نشد.\n\n" +
          "➡️ برای ادامه، سؤال بعدی را بزن."
      );

      await sendNextQuizQuestion(
        bot,
        result.sessionId,
        processTimeout
      );
    } catch (error) {
      console.error(
        "Quiz timeout failed:",
        error
      );
    }
  }, timeoutMs);

  quizTimers.set(sessionId, timer);
}

async function getTelegramUserIdByUserId(
  bot,
  userId
) {
  if (!userId) {
    return null;
  }

  try {
    const telegramUser =
      await bot.telegram.getChat(userId);

    return telegramUser?.id || userId;
  } catch {
    return userId;
  }
}

async function sendQuizFinishedMessage(
  bot,
  sessionId,
  result
) {
  clearQuizTimer(sessionId);

  const telegramUserId =
    await getTelegramUserIdByUserId(
      bot,
      result.userId
    );

  if (!telegramUserId) {
    return;
  }

  const correct = Number(
    result.correctAnswers ||
      result.player?.correctAnswers ||
      0
  );

  const total = Number(
    result.totalQuestions ||
      result.player?.totalQuestions ||
      0
  );

  await bot.telegram.sendMessage(
    telegramUserId,
    `🏁 مسابقه تمام شد!\n\n` +
      `✅ پاسخ درست: ${correct}\n` +
      `❌ پاسخ غلط: ${Math.max(
        0,
        total - correct
      )}\n` +
      `📊 مجموع سؤال‌ها: ${total}\n\n` +
      `🎁 پاداش مسابقه ثبت شد.`
  );
}

async function sendNextQuizQuestion(
  bot,
  sessionId,
  processTimeout
) {
  const session =
    await gameService.getGameSession(sessionId);

  if (
    !session ||
    session.status !== "ACTIVE"
  ) {
    return;
  }

  const languageCode =
    session.metadata?.languageCode || "fa";

  const question =
    await prepareNextQuestion(
      sessionId,
      languageCode
    );

  if (!question) {
    return;
  }

  const options = [
    question.option_a,
    question.option_b,
    question.option_c,
    question.option_d,
  ].filter(
    (option) =>
      option !== null &&
      option !== undefined &&
      option !== ""
  );

  if (options.length < 2) {
    throw new Error(
      "Quiz question must have at least two options"
    );
  }

  const correctOptionId =
    getCorrectOptionIndex(question);

  const telegramUserId =
    await getTelegramUserIdByUserId(
      bot,
      session.user_id
    );

  if (!telegramUserId) {
    throw new Error(
      "Telegram user ID not found for quiz"
    );
  }

  const timeLimit =
    Number(session.metadata?.timeLimit || 10);

  const poll = await bot.telegram.sendPoll(
    telegramUserId,
    question.question,
    options,
    {
      type: "quiz",
      is_anonymous: false,
      correct_option_id: correctOptionId,
      open_period: timeLimit,
      allows_multiple_answers: false,
    }
  );

  await registerPoll(sessionId, {
    pollId: poll.poll.id,
    chatId: poll.chat.id,
    messageId: poll.message_id,
    questionId: question.id,
    sentAt: new Date().toISOString(),
  });

  scheduleQuizTimeout(
    bot,
    sessionId,
    poll.poll.id,
    timeLimit,
    processTimeout
  );
}

function createQuizHandler({
  bot,
  menuButtons,
  config,
  processTimeout,
}) {
  if (!bot) {
    throw new Error(
      "createQuizHandler requires bot"
    );
  }

  if (!processTimeout) {
    throw new Error(
      "createQuizHandler requires processTimeout"
    );
  }

  bot.hears("🧠 مسابقه", async (ctx) => {
    try {
      const userId = ctx.from?.id;

      if (!userId) {
        return;
      }

      const languageCode =
        ctx.from?.language_code || "fa";

      const activeQuiz =
        await findActiveQuizByUser(userId);

      if (activeQuiz) {
        await ctx.reply(
          "⏳ یک مسابقه فعال داری.\n\n" +
            "اول همان مسابقه را تمام یا لغو کن."
        );

        return;
      }

      const result = await startQuiz({
        userId,
        languageCode,
      });

      await ctx.reply(
        `🧠 مسابقه شروع شد!\n\n` +
          `❓ تعداد سؤال‌ها: ${result.totalQuestions}\n` +
          `⏱ زمان هر سؤال: ${config.timeLimit} ثانیه\n` +
          `💳 هزینه: 1 اعتبار\n\n` +
          `موفق باشی!`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "❌ لغو مسابقه",
              "quiz_cancel_confirm"
            ),
          ],
        ])
      );

      await sendNextQuizQuestion(
        bot,
        result.session.id,
        processTimeout
      );
    } catch (error) {
      console.error(
        "Quiz start failed:",
        error
      );

      await ctx.reply(
        "❌ شروع مسابقه انجام نشد.\n\n" +
          "لطفاً دوباره تلاش کن."
      );
    }
  });

  bot.hears("❌ لغو مسابقه", async (ctx) => {
    try {
      const userId = ctx.from?.id;

      const activeQuiz =
        await findActiveQuizByUser(userId);

      if (!activeQuiz) {
        await ctx.reply(
          "ℹ️ مسابقه فعالی نداری.",
          menuButtons
        );

        return;
      }

      await ctx.reply(
        "⚠️ مطمئنی می‌خواهی مسابقه را لغو کنی؟",
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "✅ بله، لغو کن",
              "quiz_cancel_confirm"
            ),
            Markup.button.callback(
              "❌ نه",
              "quiz_cancel_back"
            ),
          ],
        ])
      );
    } catch (error) {
      console.error(
        "Quiz cancel confirmation failed:",
        error
      );
    }
  });

  bot.action(
    "quiz_cancel_confirm",
    async (ctx) => {
      try {
        await ctx.answerCbQuery();

        const userId = ctx.from?.id;

        const result =
          await cancelUserActiveQuiz(userId);

        if (!result) {
          await ctx.editMessageText(
            "ℹ️ مسابقه فعالی وجود ندارد."
          );

          return;
        }

        await ctx.editMessageText(
          "❌ مسابقه لغو شد.\n\n" +
            "اعتبار رزروشده آزاد شد."
        );

        if (menuButtons) {
          await ctx.reply(
            "🎮 منوی مینی‌گیم‌ها",
            menuButtons
          );
        }
      } catch (error) {
        console.error(
          "Quiz cancel failed:",
          error
        );

        try {
          await ctx.answerCbQuery(
            "خطا در لغو مسابقه",
            {
              show_alert: true,
            }
          );
        } catch {}
      }
    }
  );

  bot.action(
    "quiz_cancel_back",
    async (ctx) => {
      try {
        await ctx.answerCbQuery();

        await ctx.editMessageText(
          "▶️ مسابقه ادامه دارد."
        );
      } catch (error) {
        console.error(
          "Quiz cancel back failed:",
          error
        );
      }
    }
  );

  bot.action(
    /^quiz_next:(.+)$/,
    async (ctx) => {
      try {
        await ctx.answerCbQuery();

        const sessionId = ctx.match[1];

        const session =
          await gameService.getGameSession(
            sessionId
          );

        if (
          !session ||
          session.status !== "ACTIVE"
        ) {
          await ctx.reply(
            "ℹ️ این مسابقه دیگر فعال نیست."
          );

          return;
        }

        await sendNextQuizQuestion(
          bot,
          sessionId,
          processTimeout
        );
      } catch (error) {
        console.error(
          "Next quiz question failed:",
          error
        );

        try {
          await ctx.answerCbQuery(
            "❌ رفتن به سؤال بعدی انجام نشد.",
            {
              show_alert: true,
            }
          );
        } catch {}
      }
    }
  );

  bot.on(
    "poll_answer",
    async (ctx) => {
      try {
        const answer =
          ctx.update?.poll_answer;

        if (!answer) {
          return;
        }

        const pollId = answer.poll_id;

        const optionIds =
          Array.isArray(answer.option_ids)
            ? answer.option_ids
            : [];

        if (
          !pollId ||
          optionIds.length === 0
        ) {
          return;
        }

        const result =
          await processPollAnswer({
            pollId,
            optionIndex: optionIds[0],
          });

        if (
          !result ||
          !result.handled
        ) {
          return;
        }

        clearQuizTimer(
          result.sessionId
        );

        const telegramUserId =
          answer.user?.id;

        if (!telegramUserId) {
          return;
        }

        if (result.finished) {
          await sendQuizFinishedMessage(
            bot,
            result.sessionId,
            result
          );

          return;
        }

        let message;

        if (result.correct) {
          message =
            "✅ درست بود!\n\n" +
            `💳 +${result.reward.credit} اعتبار\n` +
            `✨ +${result.reward.xp} XP`;
        } else {
          message =
            "❌ اشتباه بود.\n\n" +
            "🎁 برای این سؤال پاداشی دریافت نکردی.";
        }

        await bot.telegram.sendMessage(
          telegramUserId,
          message,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "➡️ سؤال بعدی",
                `quiz_next:${result.sessionId}`
              ),
            ],
          ])
        );
      } catch (error) {
        console.error(
          "Quiz poll answer failed:",
          error
        );
      }
    }
  );
}

module.exports = {
  createQuizHandler,
  clearQuizTimer,
  cancelUserActiveQuiz,
  sendNextQuizQuestion,
};
