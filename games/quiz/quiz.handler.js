const { Markup } = require("telegraf");

const {
  startQuiz,
  prepareNextQuestion,
  registerPoll,
  processPollAnswer,
    processTimeout,
  findSessionByPollId,
  findActiveQuizByUser,
} = require("./quiz.service");

const gameService = require("../game.service");
const userRepository = require("../../repositories/user.repository");
const quizReportService = require("../../services/quiz-report.service");

const quizTimers = new Map();
const quizResultTimers = new Map();
const quizNextLocks = new Set();
async function deleteQuizMessage(
  bot,
  chatId,
  messageId
) {
  if (
    !bot ||
    !chatId ||
    !messageId
  ) {
    return;
  }

  try {
    await bot.telegram.deleteMessage(
      chatId,
      messageId
    );
  } catch (error) {
    console.error(
      "Quiz message deletion failed:",
      error
    );
  }
}

function clearQuizTimer(sessionId) {
  const timer = quizTimers.get(sessionId);

  if (timer) {
    clearTimeout(timer);
    quizTimers.delete(sessionId);
  }
}

function clearQuizResultTimer(sessionId) {
  const key = String(sessionId);
  const resultTimer = quizResultTimers.get(key);

  if (resultTimer) {
    clearTimeout(resultTimer.timer);
    quizResultTimers.delete(key);
  }

  return resultTimer || null;
}

function shuffleQuizOptions(question) {
  const options = [
    {
      letter: "A",
      text: question.option_a,
    },
    {
      letter: "B",
      text: question.option_b,
    },
    {
      letter: "C",
      text: question.option_c,
    },
    {
      letter: "D",
      text: question.option_d,
    },
  ].filter(
    (option) =>
      option.text !== null &&
      option.text !== undefined &&
      option.text !== ""
  );

  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [options[i], options[j]] = [
      options[j],
      options[i],
    ];
  }

  return options;
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

async function cancelUserActiveQuiz(bot, userId) {
  const session = await findActiveQuizByUser(userId);

  if (!session) {
    return null;
  }

  clearQuizTimer(session.id);

const resultTimer = clearQuizResultTimer(session.id);

if (resultTimer) {
  await deleteQuizMessage(
    bot,
    resultTimer.chatId,
    resultTimer.messageId
  );
}

quizNextLocks.delete(String(session.id));

  return gameService.cancelGame(
    session.id,
    "Cancelled by user"
  );
}

async function sendQuizFinishedMessage(
  bot,
  sessionId,
  result
) {
  clearQuizTimer(sessionId);
  quizNextLocks.delete(String(sessionId));

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
  const lockKey = String(sessionId);

  if (quizNextLocks.has(lockKey)) {
    return;
  }

  quizNextLocks.add(lockKey);

  try {
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

    const shuffledOptions =
      shuffleQuizOptions(question);

    const options =
      shuffledOptions.map(
        (option) =>
          option.text
      );

    if (options.length < 2) {
      throw new Error(
        "Quiz question must have at least two options"
      );
    }

    const correctLetter =
      String(
        question.correct_option || ""
      )
        .trim()
        .toUpperCase();

    const correctOptionId =
      shuffledOptions.findIndex(
        (option) =>
          option.letter ===
          correctLetter
      );

    if (correctOptionId < 0) {
      throw new Error(
        "Invalid quiz correct option"
      );
    }

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
          open_period:
            timeLimit,
          allows_multiple_answers:
            false,
        }
      );

    const reportMessage =
  await bot.telegram.sendMessage(
    telegramUserId,
    "اگر مشکلی در این سؤال می‌بینی، می‌توانی آن را گزارش کنی.",
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "🚨 گزارش سؤال",
          `quiz_report:${question.id}`
        ),
      ],
    ])
  );

await registerPoll(
  sessionId,
  {
    pollId:
      poll.poll.id,

    chatId:
      poll.chat.id,

    messageId:
      poll.message_id,

    reportMessageId:
      reportMessage.message_id,

    questionId:
      question.id,

    sentAt:
      new Date().toISOString(),

    optionLetters:
      shuffledOptions.map(
        (option) =>
          option.letter
      ),
  }
);

    clearQuizTimer(sessionId);

    const timer =
      setTimeout(
        async () => {
          quizTimers.delete(
            sessionId
          );

          try {
  const pollSession =
    await findSessionByPollId(
      poll.poll.id
    );

  const pollMetadata =
    pollSession?.metadata || {};

  const pollChatId =
    pollMetadata.pollChatId;

  const pollMessageId =
    pollMetadata.pollMessageId;

  const pollReportMessageId =
    pollMetadata.pollReportMessageId;

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

            await deleteQuizMessage(
  bot,
  pollChatId,
  pollMessageId
);

await deleteQuizMessage(
  bot,
  pollChatId,
  pollReportMessageId
);

            const currentSession =
              await gameService.getGameSession(
                sessionId
              );

            if (!currentSession) {
              return;
            }

            const telegramId =
              await getTelegramUserIdByUserId(
                currentSession.user_id
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
                {
                  ...timeoutResult,
                  userId:
                    currentSession.user_id,
                }
              );

              return;
            }

            await bot.telegram.sendMessage(
              telegramId,
              "⏰ زمان این سؤال تمام شد.\n\n" +
                "❌ پاسخی ثبت نشد.\n\n" +
                "➡️ سؤال بعدی در حال آماده‌سازی است..."
            );

            setTimeout(() => {
              sendNextQuizQuestion(
                bot,
                sessionId
              ).catch((error) => {
                console.error(
                  "Auto next quiz question after timeout failed:",
                  error
                );
              });
            }, 3000);
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
  } finally {
    quizNextLocks.delete(
      lockKey
    );
  }
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
            userId:
              user.id,

            languageCode,
          });

        const questionCount =
          Number(
            result.config
              ?.questionCount ||
              10
          );

        const timeLimit =
          Number(
            result.config
              ?.timeLimit ||
              10
          );

        const cost =
          Number(
            result.session
              ?.reserved_cost ||
              1
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
    bot,
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
              show_alert:
                true,
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

        const resultTimer =
  clearQuizResultTimer(sessionId);

if (resultTimer) {
  await deleteQuizMessage(
    bot,
    resultTimer.chatId,
    resultTimer.messageId
  );
}

        const session =
          await gameService.getGameSession(
            sessionId
          );

        if (
          !session ||
          session.status !==
            "ACTIVE"
        ) {
          await ctx.reply(
            "ℹ️ این مسابقه دیگر فعال نیست."
          );

          return;
        }

        const user =
          await userRepository.findByTelegramId(
            String(
              ctx.from.id
            )
          );

        if (
          !user ||
          String(
            session.user_id
          ) !==
            String(user.id)
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
              show_alert:
                true,
            }
          );
        } catch {}
      }
    }
  );

  bot.action(
    /^quiz_report:(\d+)$/,
    async (ctx) => {
      try {
        await ctx.answerCbQuery();

        const questionId =
          Number(ctx.match[1]);

        if (!questionId) {
          return;
        }

        await ctx.editMessageText(
          "🚨 دلیل گزارش سؤال را انتخاب کن:",
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "❌ جواب صحیح اشتباه است",
                `quiz_report_reason:${questionId}:WRONG_ANSWER`
              ),
            ],
            [
              Markup.button.callback(
                "❓ متن سؤال مشکل دارد",
                `quiz_report_reason:${questionId}:BAD_QUESTION`
              ),
            ],
            [
              Markup.button.callback(
                "🅰️🅱️ گزینه‌ها مشکل دارند",
                `quiz_report_reason:${questionId}:BAD_OPTIONS`
              ),
            ],
            [
              Markup.button.callback(
                "🔄 سؤال تکراری است",
                `quiz_report_reason:${questionId}:DUPLICATE`
              ),
            ],
            [
              Markup.button.callback(
                "⚠️ سؤال مبهم/غیرقابل‌اعتماد است",
                `quiz_report_reason:${questionId}:UNRELIABLE`
              ),
            ],
            [
              Markup.button.callback(
                "📝 سایر",
                `quiz_report_reason:${questionId}:OTHER`
              ),
            ],
          ])
        );
      } catch (error) {
        console.error(
          "Quiz report menu failed:",
          error
        );

        try {
          await ctx.answerCbQuery(
            "❌ نمایش گزینه‌های گزارش انجام نشد.",
            {
              show_alert: true,
            }
          );
        } catch {}
      }
    }
  );

  bot.action(
    /^quiz_report_reason:(\d+):([A-Z_]+)$/,
    async (ctx) => {
      try {
        await ctx.answerCbQuery();

        const questionId =
          Number(ctx.match[1]);

        const reason =
          String(ctx.match[2])
            .trim()
            .toUpperCase();

        const telegramUserId =
          ctx.from?.id;

        if (
          !questionId ||
          !telegramUserId
        ) {
          return;
        }

        const user =
          await userRepository.findByTelegramId(
            String(telegramUserId)
          );

        if (!user) {
          await ctx.editMessageText(
            "❌ کاربر پیدا نشد."
          );

          return;
        }

        const result =
          await quizReportService.createReport({
            questionId,
            userId: user.id,
            reason,
          });

        if (result.created) {
          await ctx.editMessageText(
            "✅ گزارش شما ثبت شد.\n\n" +
              "ممنون که به بهتر شدن بانک سؤالات کمک می‌کنی."
          );

          return;
        }

        if (result.duplicate) {
          await ctx.editMessageText(
            "ℹ️ این سؤال را قبلاً گزارش کرده‌ای.\n\n" +
              "گزارش قبلی هنوز در حال بررسی است."
          );

          return;
        }

        await ctx.editMessageText(
          "❌ ثبت گزارش انجام نشد."
        );
      } catch (error) {
        console.error(
          "Quiz report submission failed:",
          error
        );

        try {
          await ctx.editMessageText(
            "❌ ثبت گزارش انجام نشد.\n\n" +
              "لطفاً بعداً دوباره تلاش کن."
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

        const pollSession =
  await findSessionByPollId(
    pollId
  );

const pollMetadata =
  pollSession?.metadata || {};

const pollChatId =
  pollMetadata.pollChatId;

const pollMessageId =
  pollMetadata.pollMessageId;

const pollReportMessageId =
  pollMetadata.pollReportMessageId;

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

        await deleteQuizMessage(
  bot,
  pollChatId,
  pollMessageId
);

await deleteQuizMessage(
  bot,
  pollChatId,
  pollReportMessageId
);

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

        const resultMessage =
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

const resultTimer = setTimeout(async () => {
  quizResultTimers.delete(
    String(result.sessionId)
  );

  await deleteQuizMessage(
    bot,
    telegramUserId,
    resultMessage.message_id
  );

  sendNextQuizQuestion(
    bot,
    result.sessionId
  ).catch((error) => {
    console.error(
      "Auto next quiz question failed:",
      error
    );
  });
}, 3000);

quizResultTimers.set(
  String(result.sessionId),
  {
    timer: resultTimer,
    chatId: telegramUserId,
    messageId: resultMessage.message_id,
  }
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

  for (const resultTimer of quizResultTimers.values()) {
    clearTimeout(resultTimer.timer);
  }

  quizResultTimers.clear();

  quizNextLocks.clear();
}

module.exports = {
  createQuizHandler,
  cleanupQuizTimers,
  clearQuizTimer,
  cancelUserActiveQuiz,
  sendNextQuizQuestion,
};
