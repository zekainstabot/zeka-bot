const { Markup } = require("telegraf");

const {
  startQuiz,
  prepareNextQuestion,
  registerPoll,
  processPollAnswer,
  processTimeout,
  findActiveQuizByUser,
} = require("./quiz.service");

const gameService = require("../game.service");
const userRepository = require("../../repositories/user.repository");

const quizTimers = new Map();

function clearQuizTimer(sessionId) {
  const timer = quizTimers.get(sessionId);

  if (timer) {
    clearTimeout(timer);
    quizTimers.delete(sessionId);
  }
}

async function getTelegramUserIdByUserId(userId) {
  if (!userId) {
    return null;
  }

  const user = await userRepository.findById(userId);

  if (!user) {
    return null;
  }

  return user.telegram_user_id
    ? String(user.telegram_user_id)
    : null;
}

async function cancelUserActiveQuiz(userId) {
  const session = await findActiveQuizByUser(userId);

  if (!session) {
    return null;
  }

  clearQuizTimer(session.id);

  return gameService.cancelGame(
    session.id,
    "Cancelled by user"
  );
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

  const correctOption = String(
    question.correct_option || ""
  )
    .trim()
    .toUpperCase();

  const correctIndex = ["A", "B", "C", "D"].indexOf(
    correctOption
  );

  if (
    correctIndex < 0 ||
    correctIndex >= options.length
  ) {
    throw new Error(
      "Invalid quiz correct option"
    );
  }

  return correctIndex;
}

async function sendQuizFinishedMessage(
  bot,
  sessionId,
  result
) {
  clearQuizTimer(sessionId);

  const telegramUserId =
    await getTelegramUserIdByUserId(
      result.userId ||
        result.user_id
    );

  if (!telegramUserId) {
    return;
  }

  const correct = Number(
    result.score || 0
  );

  const total = Number(
    result.totalRounds || 0
  );

  const rewardCredit = Number(
    result.reward?.credit || 0
  );

  const rewardXp = Number(
    result.reward?.xp || 0
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
      `🎁 پاداش اعتبار: +${rewardCredit}\n` +
      `✨ پاداش XP: +${rewardXp}`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "🔙 بازگشت به مینی‌گیم‌ها",
          "quiz_finish_back"
        ),
      ],
    ])
  );
}

async function sendNextQuizQuestion(
  bot,
  sessionId
) {
  const session =
    await gameService.getGameSession(
      sessionId
    );

  if (
    !session ||
    session.status !== "ACTIVE"
  ) {
    return;
  }

  const languageCode =
    session.metadata?.languageCode ||
    "fa";

  const prepared =
    await prepareNextQuestion(
      sessionId,
      languageCode
    );

  if (!prepared) {
    return;
  }

  if (prepared.finished) {
    return;
  }

  const question =
    prepared.question;

  if (!question) {
    throw new Error(
      "Quiz question not found"
    );
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
    getCorrectOptionIndex(
      question
    );

  const telegramUserId =
    await getTelegramUserIdByUserId(
      prepared.session.user_id
    );

  if (!telegramUserId) {
    throw new Error(
      "Telegram user ID not found for quiz"
    );
  }

  const timeLimit = Math.max(
    5,
    Number(
      prepared.config?.timeLimit || 10
    )
  );

  const poll =
    await bot.telegram.sendPoll(
      telegramUserId,
      `🧠 سؤال ${prepared.round} از ${prepared.session.total_rounds}\n\n${question.question_text}`,
      options,
      {
        type: "quiz",
        is_anonymous: false,
        correct_option_id:
          correctOptionId,
        open_period: timeLimit,
        allows_multiple_answers: false,
      }
    );

  await registerPoll(
    sessionId,
    {
      pollId: poll.poll.id,
      chatId: poll.chat.id,
      messageId: poll.message_id,
      questionId: question.id,
      sentAt:
        new Date().toISOString(),
    }
  );

  clearQuizTimer(sessionId);

  const timer = setTimeout(
    async () => {
      quizTimers.delete(
        sessionId
      );

      try {
        const timeoutResult =
          await processTimeout(
            sessionId,
            poll.poll.id
          );

        if (
          !timeoutResult ||
          !timeoutResult.handled
        ) {
          return;
        }

        const telegramId =
          await getTelegramUserIdByUserId(
            sessionId
              ? (
                  await gameService.getGameSession(
                    sessionId
                  )
                )?.user_id
              : null
          );

        if (!telegramId) {
          return;
        }

        if (
          timeoutResult.finished
        ) {
          await sendQuizFinishedMessage(
            bot,
            sessionId,
            timeoutResult
          );

          return;
        }

        await bot.telegram.sendMessage(
          telegramId,
          "⏰ زمان این سؤال تمام شد.\n\n" +
            "❌ پاسخی ثبت نشد.\n\n" +
            "➡️ برای ادامه، سؤال بعدی را بزن.",
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "➡️ سؤال بعدی",
                `quiz_next:${sessionId}`
              ),
            ],
          ])
        );
      } catch (error) {
        console.error(
          "Quiz timeout failed:",
          error
        );
      }
    },
    timeLimit * 1000
  );

  quizTimers.set(
    sessionId,
    timer
  );
}

function createQuizHandler({
  bot,
  menuButtons,
  gamesMenu,
}) {
  if (!bot) {
    throw new Error(
      "createQuizHandler requires bot"
    );
  }

  bot.hears(
    "🧠 مسابقه",
    async (ctx) => {
      try {
        const telegramUserId =
          ctx.from?.id;

        if (!telegramUserId) {
          return;
        }

        const user =
          await userRepository.findByTelegramId(
            String(
              telegramUserId
            )
          );

        if (!user) {
          await ctx.reply(
            "❌ کاربر پیدا نشد. لطفاً /start را بزن."
          );

          return;
        }

        const activeQuiz =
          await findActiveQuizByUser(
            user.id
          );

        if (activeQuiz) {
          await ctx.reply(
            "⏳ یک مسابقه فعال داری.\n\n" +
              "اول همان مسابقه را تمام یا لغو کن."
          );

          return;
        }

        const languageCode =
          ctx.from?.language_code ||
          "fa";

        const result =
          await startQuiz({
            userId: user.id,
            languageCode,
          });

        const questionCount =
          Number(
            result.config
              ?.questionCount || 10
          );

        const timeLimit =
          Number(
            result.config
              ?.timeLimit || 10
          );

        const cost =
          Number(
            result.session
              ?.reserved_cost || 1
          );

        await ctx.reply(
          `🧠 مسابقه شروع شد!\n\n` +
            `❓ تعداد سؤال‌ها: ${questionCount}\n` +
            `⏱ زمان هر سؤال: ${timeLimit} ثانیه\n` +
            `💳 هزینه: ${cost} اعتبار\n\n` +
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
          result.session.id
        );
      } catch (error) {
        console.error(
          "Quiz start failed:",
          error
        );

        if (
          error.code ===
          "ACTIVE_QUIZ_EXISTS"
        ) {
          await ctx.reply(
            "⏳ یک مسابقه فعال داری."
          );

          return;
        }

        await ctx.reply(
          "❌ شروع مسابقه انجام نشد.\n\n" +
            "لطفاً دوباره تلاش کن."
        );
      }
    }
  );

  bot.hears(
    "❌ لغو مسابقه",
    async (ctx) => {
      try {
        const telegramUserId =
          ctx.from?.id;

        const user =
          await userRepository.findByTelegramId(
            String(
              telegramUserId
            )
          );

        if (!user) {
          return;
        }

        const activeQuiz =
          await findActiveQuizByUser(
            user.id
          );

        if (!activeQuiz) {
          await ctx.reply(
            "ℹ️ مسابقه فعالی نداری.",
            gamesMenu
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
    }
  );

  bot.action(
    "quiz_cancel_confirm",
    async (ctx) => {
      try {
        await ctx.answerCbQuery();

        const telegramUserId =
          ctx.from?.id;

        const user =
          await userRepository.findByTelegramId(
            String(
              telegramUserId
            )
          );

        if (!user) {
          await ctx.editMessageText(
            "❌ کاربر پیدا نشد."
          );

          return;
        }

        const result =
          await cancelUserActiveQuiz(
            user.id
          );

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

        if (gamesMenu) {
          await ctx.reply(
            "🎮 منوی مینی‌گیم‌ها",
            gamesMenu
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

        const sessionId =
          ctx.match[1];

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

        if (
          String(
            session.user_id
          ) !==
          String(
            (
              await userRepository.findByTelegramId(
                String(
                  ctx.from.id
                )
              )
            )?.id
          )
        ) {
          return;
        }

        await sendNextQuizQuestion(
          bot,
          sessionId
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

        const pollId =
          answer.poll_id;

        const optionIds =
          Array.isArray(
            answer.option_ids
          )
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
            optionIndex:
              optionIds[0],
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

        const user =
          await userRepository.findByTelegramId(
            String(
              telegramUserId
            )
          );

        if (!user) {
          return;
        }

        const session =
          await gameService.getGameSession(
            result.sessionId
          );

        if (
          !session ||
          String(
            session.user_id
          ) !==
          String(user.id)
        ) {
          return;
        }

        if (
          result.finished
        ) {
          await sendQuizFinishedMessage(
            bot,
            result.sessionId,
            {
              ...result,
              userId:
                session.user_id,
            }
          );

          return;
        }

        let message;

        if (result.correct) {
          message =
            "✅ درست بود!\n\n" +
            `💳 +${Number(
              result.reward?.credit || 0
            )} اعتبار\n` +
            `✨ +${Number(
              result.reward?.xp || 0
            )} XP`;
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

  bot.action(
    "quiz_finish_back",
    async (ctx) => {
      try {
        await ctx.answerCbQuery();

        await ctx.reply(
          "🎮 منوی مینی‌گیم‌ها",
          gamesMenu
        );
      } catch (error) {
        console.error(
          "Quiz finish back failed:",
          error
        );
      }
    }
  );
}

function cleanupQuizTimers() {
  for (const timer of quizTimers.values()) {
    clearTimeout(timer);
  }

  quizTimers.clear();
}

module.exports = {
  createQuizHandler,
  cleanupQuizTimers,
  clearQuizTimer,
  cancelUserActiveQuiz,
  sendNextQuizQuestion,
};
