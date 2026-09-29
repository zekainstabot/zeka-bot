const { getPool } = require("../../database/pool");

const gameService = require("../game.service");
const gameSettingsService = require("../game-settings.service");

const gameRepository = require("../../repositories/game.repository");
const quizRepository = require("../../repositories/quiz.repository");

const creditService = require("../../services/credit.service");
const rewardService = require("../../services/reward.service");

const QUIZ_GAME_KEY = "quiz_general";

const DEFAULT_TIME_LIMIT = 20;
const DEFAULT_QUESTION_COUNT = 10;
const DEFAULT_REWARD_CREDIT = 0.5;
const DEFAULT_REWARD_XP = 1;
const DEFAULT_DAILY_CREDIT_CAP = 5;

// اگر مسابقه بیشتر از این مدت بدون فعالیت بماند، گیرکرده محسوب می‌شود.
const STALE_QUIZ_MINUTES = 30;

function normalizeOption(option) {
  if (option === null || option === undefined) {
    return null;
  }

  const value = String(option)
    .trim()
    .toUpperCase();

  if (!["A", "B", "C", "D"].includes(value)) {
    return null;
  }

  return value;
}

function optionIndexToLetter(index) {
  const value = Number(index);

  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 3
  ) {
    return null;
  }

  return ["A", "B", "C", "D"][value];
}

function getRewardValue(value) {
  if (!value || typeof value !== "object") {
    return {
      credit: DEFAULT_REWARD_CREDIT,
      xp: DEFAULT_REWARD_XP,
    };
  }

  const credit = Number(value.credit);
  const xp = Number(value.xp);

  return {
    credit:
      Number.isFinite(credit) && credit >= 0
        ? credit
        : DEFAULT_REWARD_CREDIT,

    xp:
      Number.isInteger(xp) && xp >= 0
        ? xp
        : DEFAULT_REWARD_XP,
  };
}

async function getQuizConfig() {
  const gameType =
    await gameService.getGameType(QUIZ_GAME_KEY);

  const enabled =
    await gameSettingsService.isGameEnabled(
      gameType.id
    );

  if (!enabled) {
    throw new Error("Quiz is disabled");
  }

  const questionCount =
    await gameSettingsService.getQuestionCount(
      gameType.id
    );

  const rewardSetting =
    await gameSettingsService.getSetting(
      gameType.id,
      "quiz_reward",
      {
        credit: DEFAULT_REWARD_CREDIT,
        xp: DEFAULT_REWARD_XP,
      }
    );

  const timeSetting =
    await gameSettingsService.getSetting(
      gameType.id,
      "quiz_time_limit",
      {
        seconds: DEFAULT_TIME_LIMIT,
      }
    );

  const dailyCreditCapSetting =
    await gameSettingsService.getSetting(
      gameType.id,
      "quiz_daily_credit_cap",
      {
        credit: DEFAULT_DAILY_CREDIT_CAP,
      }
    );

  let timeLimit = Number(
    timeSetting?.seconds ?? timeSetting
  );

  if (
    !Number.isInteger(timeLimit) ||
    timeLimit < 5 ||
    timeLimit > 60
  ) {
    timeLimit = DEFAULT_TIME_LIMIT;
  }

  let dailyCreditCap = Number(
    dailyCreditCapSetting?.credit ??
      dailyCreditCapSetting
  );

  if (
    !Number.isFinite(dailyCreditCap) ||
    dailyCreditCap < 0
  ) {
    dailyCreditCap = DEFAULT_DAILY_CREDIT_CAP;
  }

  return {
    gameType,

    questionCount:
      Number.isInteger(questionCount) &&
      questionCount > 0
        ? questionCount
        : DEFAULT_QUESTION_COUNT,

    reward: getRewardValue(rewardSetting),

    timeLimit,

    dailyCreditCap,
  };
}

async function startQuiz({
  userId,
  languageCode = "fa",
}) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  await cleanupStaleQuizForUser(userId);

  const activeQuiz =
    await findActiveQuizByUser(userId);

  if (activeQuiz) {
    const error = new Error(
      "ACTIVE_QUIZ_EXISTS"
    );

    error.code = "ACTIVE_QUIZ_EXISTS";
    error.sessionId = activeQuiz.id;

    throw error;
  }

  const config =
    await getQuizConfig();

  const cost =
    await gameSettingsService.getGameCost(
      config.gameType.id
    );

  const session =
    await gameService.startGame({
      userId,

      gameKey:
        QUIZ_GAME_KEY,

      cost,

      totalRounds:
        config.questionCount,

      metadata: {
        game:
          QUIZ_GAME_KEY,

        languageCode,

        currentRound:
          0,

        currentQuestionId:
          null,

        currentPollId:
          null,

        pollOptionLetters:
          null,

        pollChatId:
          null,

        pollMessageId:
          null,

        pollReportMessageId:
  null,

        pollSentAt:
          null,

        usedQuestionIds:
          [],

        processing:
          false,

        lastActivityAt:
          new Date().toISOString(),
      },
    });

  try {
    await quizRepository.createPlayer({
      sessionId:
        session.id,

      userId,

      playerNumber:
        1,

      reservedCost:
        cost,
    });

    return {
      session,
      config,
    };
  } catch (error) {
    try {
      await gameService.cancelGame(
        session.id,
        error.message
      );
    } catch (cancelError) {
      console.error(
        "Failed to cancel quiz session:",
        cancelError
      );
    }

    throw error;
  }
}

async function cleanupStaleQuizForUser(userId) {
  if (!userId) {
    return null;
  }

  const pool =
    getPool();

  const result =
    await pool.query(
      `
        SELECT
          gs.*
        FROM game_sessions gs
        INNER JOIN game_types gt
          ON gt.id = gs.game_type_id
        WHERE gs.user_id = $1
          AND gs.status = 'ACTIVE'
          AND gt.game_key = $2
        ORDER BY gs.id DESC
      `,
      [
        userId,
        QUIZ_GAME_KEY,
      ]
    );

  if (!result.rows.length) {
    return null;
  }

  let cleaned = null;

  for (const session of result.rows) {
    const metadata =
      session.metadata || {};

    let lastActivityTime =
      null;

    if (metadata.lastActivityAt) {
      const date =
        new Date(
          metadata.lastActivityAt
        );

      if (!Number.isNaN(date.getTime())) {
        lastActivityTime = date;
      }
    }

    if (
      !lastActivityTime &&
      metadata.pollSentAt
    ) {
      const date =
        new Date(
          metadata.pollSentAt
        );

      if (!Number.isNaN(date.getTime())) {
        lastActivityTime = date;
      }
    }

    if (!lastActivityTime) {
      const date =
        new Date(
          session.updated_at ||
            session.created_at
        );

      if (!Number.isNaN(date.getTime())) {
        lastActivityTime = date;
      }
    }

    if (!lastActivityTime) {
      continue;
    }

    const ageMs =
      Date.now() -
      lastActivityTime.getTime();

    const staleMs =
      STALE_QUIZ_MINUTES *
      60 *
      1000;

    if (ageMs < staleMs) {
      continue;
    }

    try {
      cleaned =
        await gameService.cancelGame(
          session.id,
          `Quiz automatically cancelled after ${STALE_QUIZ_MINUTES} minutes of inactivity`
        );

      console.log(
        `Stale quiz session ${session.id} cancelled for user ${userId}`
      );
    } catch (error) {
      console.error(
        `Failed to cleanup stale quiz session ${session.id}:`,
        error
      );
    }
  }

  return cleaned;
}

async function prepareNextQuestion(
  sessionId,
  languageCode = "fa"
) {
  const session =
    await gameService.getGameSession(
      sessionId
    );

  if (!session) {
    throw new Error(
      "Quiz session not found"
    );
  }

  if (
    session.status !== "ACTIVE"
  ) {
    return {
      finished: true,
      session,
    };
  }

  const config =
    await getQuizConfig();

  const metadata =
    session.metadata || {};

  const usedQuestionIds =
    Array.isArray(
      metadata.usedQuestionIds
    )
      ? metadata.usedQuestionIds
      : [];

  const nextRound =
    Number(
      session.current_round || 0
    ) + 1;

  const totalRounds =
    Number(
      session.total_rounds ||
        config.questionCount
    );

  if (
    nextRound > totalRounds
  ) {
    return {
      finished: true,
      session,
    };
  }

  let question =
    await quizRepository.getRandomQuestion({
      languageCode,

      excludedIds:
        usedQuestionIds,
    });

  if (!question) {
    question =
      await quizRepository.getRandomQuestionAnyLanguage({
        excludedIds:
          usedQuestionIds,
      });
  }

  if (!question) {
    throw new Error(
      "No active quiz questions available"
    );
  }

  const now =
    new Date().toISOString();

  const nextMetadata = {
    ...metadata,

    languageCode,

    currentRound:
      nextRound,

    currentQuestionId:
      Number(question.id),

    currentPollId:
      null,

    pollOptionLetters:
      null,

    pollChatId:
      null,

    pollReportMessageId:
  null,

    pollMessageId:
      null,

    pollSentAt:
      null,

    usedQuestionIds: [
      ...usedQuestionIds,
      Number(question.id),
    ],

    processing:
      false,

    lastActivityAt:
      now,
  };

  const updatedSession =
    await gameRepository.updateSession(
      session.id,
      {
        current_round:
          nextRound,

        metadata:
          nextMetadata,
      }
    );

  return {
    finished: false,

    session:
      updatedSession,

    question,

    config,

    round:
      nextRound,
  };
}

async function registerPoll(
  sessionId,
  {
  pollId,
  chatId,
  messageId,
  reportMessageId,
  questionId,
  sentAt,
  optionLetters,
}
) {
  if (!pollId) {
    throw new Error(
      "Poll ID is required"
    );
  }

  const session =
    await gameService.getGameSession(
      sessionId
    );

  if (!session) {
    throw new Error(
      "Quiz session not found"
    );
  }

  const metadata =
    session.metadata || {};

  const now =
    new Date().toISOString();

  const normalizedOptionLetters =
    Array.isArray(optionLetters)
      ? optionLetters
          .map((letter) =>
            normalizeOption(letter)
          )
          .filter(Boolean)
      : null;

  const updatedMetadata = {
    ...metadata,

    currentPollId:
      String(pollId),

    currentQuestionId:
      Number(questionId),

    pollOptionLetters:
      normalizedOptionLetters,

    pollChatId:
      Number(chatId),

    pollMessageId:
      Number(messageId),

    pollReportMessageId:
  reportMessageId
    ? Number(reportMessageId)
    : null,

    pollSentAt:
      sentAt ||
      now,

    processing:
      false,

    lastActivityAt:
      now,
  };

  return gameRepository.updateSession(
    sessionId,
    {
      metadata:
        updatedMetadata,
    }
  );
}

async function findSessionByPollId(
  pollId
) {
  if (!pollId) {
    return null;
  }

  const pool =
    getPool();

  const result =
    await pool.query(
      `
        SELECT *
        FROM game_sessions
        WHERE status = 'ACTIVE'
          AND metadata->>'currentPollId' = $1
        ORDER BY id DESC
        LIMIT 1
      `,
      [
        String(pollId),
      ]
    );

  return (
    result.rows[0] ||
    null
  );
}

async function findActiveQuizByUser(
  userId
) {
  if (!userId) {
    return null;
  }

  await cleanupStaleQuizForUser(
    userId
  );

  const pool =
    getPool();

  const result =
    await pool.query(
      `
        SELECT
          gs.*
        FROM game_sessions gs
        INNER JOIN game_types gt
          ON gt.id = gs.game_type_id
        WHERE gs.user_id = $1
          AND gs.status = 'ACTIVE'
          AND gt.game_key = $2
        ORDER BY gs.id DESC
        LIMIT 1
      `,
      [
        userId,
        QUIZ_GAME_KEY,
      ]
    );

  return (
    result.rows[0] ||
    null
  );
}

async function getDailyQuizCreditReward(
  userId,
  dailyCreditCap,
  client
) {
  const userResult =
    await client.query(
      `
        SELECT id
        FROM users
        WHERE id = $1
        FOR UPDATE
      `,
      [userId]
    );

  if (!userResult.rows[0]) {
    throw new Error(
      "User not found"
    );
  }

  const result =
    await client.query(
      `
        SELECT
          COALESCE(
            SUM(credit_amount),
            0
          ) AS total
        FROM rewards
        WHERE user_id = $1
          AND reward_type = 'QUIZ_CORRECT'
          AND source_type = 'GAME_ANSWER'
          AND created_at >= (
            DATE_TRUNC(
              'day',
              NOW() AT TIME ZONE 'Asia/Tehran'
            )
            AT TIME ZONE 'Asia/Tehran'
          )
          AND created_at < (
            (
              DATE_TRUNC(
                'day',
                NOW() AT TIME ZONE 'Asia/Tehran'
              ) + INTERVAL '1 day'
            )
            AT TIME ZONE 'Asia/Tehran'
          )
      `,
      [userId]
    );

  const used =
    Number(
      result.rows[0]?.total || 0
    );

  const remaining =
    Math.max(
      0,
      Number(dailyCreditCap) -
        used
    );

  return remaining;
}

async function processAnswer({
  sessionId,
  selectedOption = null,
  timedOut = false,
  expectedPollId = null,
}) {
  const pool =
    getPool();

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN"
    );

    const session =
      await gameRepository.findSessionByIdForUpdate(
        sessionId,
        client
      );

    if (!session) {
      await client.query(
        "ROLLBACK"
      );

      return {
        handled: false,
        reason:
          "SESSION_NOT_FOUND",
      };
    }

    if (
      session.status !== "ACTIVE"
    ) {
      await client.query(
        "ROLLBACK"
      );

      return {
        handled: false,
        reason:
          "SESSION_NOT_ACTIVE",
      };
    }

    const metadata =
      session.metadata || {};

    const currentPollId =
      metadata.currentPollId;

    if (
      expectedPollId !== null &&
      String(currentPollId) !==
        String(expectedPollId)
    ) {
      await client.query(
        "ROLLBACK"
      );

      return {
        handled: false,
        reason:
          "STALE_TIMEOUT",
      };
    }

    const questionId =
      Number(
        metadata.currentQuestionId
      );

    const round =
      Number(
        metadata.currentRound ||
          session.current_round ||
          1
      );

    if (
      !currentPollId ||
      !questionId
    ) {
      await client.query(
        "ROLLBACK"
      );

      return {
        handled: false,
        reason:
          "NO_ACTIVE_QUESTION",
      };
    }

    const player =
      await quizRepository.getPlayer(
        session.id,
        session.user_id,
        client
      );

    if (!player) {
      throw new Error(
        "Quiz player not found"
      );
    }

    const existingAnswer =
      await quizRepository.getAnswerByRound(
        player.id,
        round,
        client
      );

    if (existingAnswer) {
      await client.query(
        "ROLLBACK"
      );

      return {
        handled: false,

        reason:
          "ALREADY_ANSWERED",

        answer:
          existingAnswer,
      };
    }

    const question =
      await quizRepository.getQuestionById(
        questionId,
        client
      );

    if (!question) {
      throw new Error(
        "Quiz question not found"
      );
    }

    let normalizedOption =
      normalizeOption(
        selectedOption
      );

    if (timedOut) {
      normalizedOption =
        null;
    }

    const correctOption =
      normalizeOption(
        question.correct_option
      );

    const isCorrect =
      normalizedOption !== null &&
      normalizedOption ===
        correctOption;

    let responseTimeMs =
      null;

    if (
      metadata.pollSentAt
    ) {
      const sentAt =
        new Date(
          metadata.pollSentAt
        );

      if (
        !Number.isNaN(
          sentAt.getTime()
        )
      ) {
        responseTimeMs =
          Math.max(
            0,
            Date.now() -
              sentAt.getTime()
          );
      }
    }

    const config =
      await getQuizConfig();

    let reward = {
      credit: 0,
      xp: 0,
    };

    if (isCorrect) {
      const remainingDailyCredit =
        await getDailyQuizCreditReward(
          session.user_id,
          config.dailyCreditCap,
          client
        );

      const actualCreditReward =
        Math.min(
          Number(
            config.reward.credit || 0
          ),
          remainingDailyCredit
        );

      reward = {
        credit:
          actualCreditReward,

        xp:
          Number(
            config.reward.xp || 0
          ),
      };
    }

    const answer =
      await quizRepository.createAnswer(
        {
          sessionId:
            session.id,

          playerId:
            player.id,

          questionId:
            question.id,

          roundNumber:
            round,

          selectedOption:
            normalizedOption,

          isCorrect,

          responseTimeMs,

          creditReward:
            reward.credit,

          xpReward:
            reward.xp,

          metadata: {
            pollId:
              String(
                currentPollId
              ),

            timedOut:
              Boolean(
                timedOut
              ),
          },
        },
        client
      );

    if (!answer) {
      await client.query(
        "ROLLBACK"
      );

      return {
        handled: false,

        reason:
          "ANSWER_ALREADY_EXISTS",
      };
    }

    if (isCorrect) {
      await rewardService.grantRewardInTransaction(
        {
          userId:
            session.user_id,

          rewardType:
            "QUIZ_CORRECT",

          sourceType:
            "GAME_ANSWER",

          sourceId:
            answer.id,

          creditAmount:
            reward.credit,

          xpAmount:
            reward.xp,

          metadata: {
            game:
              QUIZ_GAME_KEY,

            sessionId:
              session.id,

            questionId:
              question.id,

            round,

            dailyCreditCap:
              config.dailyCreditCap,
          },

          client,
        }
      );
    }

    const oldScore =
      Number(
        player.score || 0
      );

    const oldCreditReward =
      Number(
        player.credit_reward || 0
      );

    const oldXp =
      Number(
        player.xp_earned || 0
      );

    const newScore =
      oldScore +
      (isCorrect ? 1 : 0);

    const newCreditReward =
      oldCreditReward +
      Number(
        reward.credit || 0
      );

    const newXp =
      oldXp +
      Number(
        reward.xp || 0
      );

    await quizRepository.updatePlayerStats(
      player.id,
      {
        score:
          newScore,

        creditReward:
          newCreditReward,

        xpEarned:
          newXp,
      },
      client
    );

    const totalRounds =
      Number(
        session.total_rounds
      );

    const finished =
      round >= totalRounds;

    const nextMetadata = {
      ...metadata,

      currentPollId:
        null,

      currentQuestionId:
        null,

      pollOptionLetters:
        null,

      pollChatId:
        null,

      pollMessageId:
        null,

      pollSentAt:
        null,

      processing:
        false,

      lastActivityAt:
        new Date().toISOString(),
    };

    if (finished) {
      await creditService.consumeGameCreditInTransaction(
        session.id,
        client
      );

      await gameRepository.updateSession(
        session.id,
        {
          status:
            "COMPLETED",

          current_round:
            totalRounds,

          result: {
            score:
              newScore,

            totalRounds,

            creditReward:
              newCreditReward,

            xpReward:
              newXp,
          },

          metadata:
            nextMetadata,

          completed_at:
            new Date(),
        },
        client
      );
    } else {
      await gameRepository.updateSession(
        session.id,
        {
          metadata:
            nextMetadata,
        },
        client
      );
    }

    await client.query(
      "COMMIT"
    );

    return {
      handled: true,

      correct:
        isCorrect,

      timedOut:
        Boolean(
          timedOut
        ),

      reward,

      answer,

      question,

      sessionId:
        session.id,

      finished,

      score:
        newScore,

      totalRounds,

      nextRound:
        finished
          ? null
          : round + 1,
    };
  } catch (error) {
    await client.query(
      "ROLLBACK"
    );

    throw error;
  } finally {
    client.release();
  }
}

async function processPollAnswer({
  pollId,
  optionIndex,
}) {
  if (!pollId) {
    return {
      handled: false,

      reason:
        "POLL_ID_MISSING",
    };
  }

  const session =
    await findSessionByPollId(
      pollId
    );

  if (!session) {
    return {
      handled: false,

      reason:
        "SESSION_NOT_FOUND",
    };
  }

  const metadata =
    session.metadata || {};

  let selectedOption =
    null;

  const pollOptionLetters =
    Array.isArray(
      metadata.pollOptionLetters
    )
      ? metadata.pollOptionLetters
      : null;

  if (
    pollOptionLetters &&
    Number.isInteger(
      Number(optionIndex)
    )
  ) {
    const index =
      Number(optionIndex);

    selectedOption =
      normalizeOption(
        pollOptionLetters[index]
      );
  }

  /*
   * سازگاری با Pollهای قدیمی:
   * اگر mapping داخل metadata وجود نداشت،
   * ترتیب عادی A/B/C/D استفاده می‌شود.
   */
  if (!selectedOption) {
    selectedOption =
      optionIndexToLetter(
        optionIndex
      );
  }

  if (!selectedOption) {
    return {
      handled: false,

      reason:
        "INVALID_OPTION",
    };
  }

  return processAnswer({
    sessionId:
      session.id,

    selectedOption,

    timedOut:
      false,

    expectedPollId:
      pollId,
  });
}

async function processTimeout(
  sessionId,
  expectedPollId
) {
  if (!sessionId) {
    return {
      handled: false,

      reason:
        "SESSION_ID_MISSING",
    };
  }

  if (!expectedPollId) {
    return {
      handled: false,

      reason:
        "POLL_ID_MISSING",
    };
  }

  const session =
    await gameService.getGameSession(
      sessionId
    );

  if (!session) {
    return {
      handled: false,

      reason:
        "SESSION_NOT_FOUND",
    };
  }

  if (
    session.status !== "ACTIVE"
  ) {
    return {
      handled: false,

      reason:
        "SESSION_NOT_ACTIVE",
    };
  }

  const metadata =
    session.metadata || {};

  if (
    !metadata.currentPollId
  ) {
    return {
      handled: false,

      reason:
        "NO_ACTIVE_POLL",
    };
  }

  if (
    String(
      metadata.currentPollId
    ) !==
    String(expectedPollId)
  ) {
    return {
      handled: false,

      reason:
        "STALE_TIMEOUT",
    };
  }

  return processAnswer({
    sessionId,

    selectedOption:
      null,

    timedOut:
      true,

    expectedPollId:
      expectedPollId,
  });
}

async function cancelQuiz(
  sessionId,
  reason = "Quiz cancelled"
) {
  return gameService.cancelGame(
    sessionId,
    reason
  );
}

module.exports = {
  QUIZ_GAME_KEY,

  getQuizConfig,

  startQuiz,

  prepareNextQuestion,

  registerPoll,

  findSessionByPollId,

  findActiveQuizByUser,

  processPollAnswer,

  processTimeout,

  cancelQuiz,

  cleanupStaleQuizForUser,
};
