const { getPool } = require("../../database/pool");

const gameService = require("../game.service");
const gameSettingsService = require("../game-settings.service");

const gameRepository = require("../../repositories/game.repository");
const quizRepository = require("../../repositories/quiz.repository");

const creditService = require("../../services/credit.service");
const rewardService = require("../../services/reward.service");

const QUIZ_GAME_KEY = "quiz_general";

const DEFAULT_TIME_LIMIT = 10;
const DEFAULT_QUESTION_COUNT = 10;
const DEFAULT_REWARD_CREDIT = 0.5;
const DEFAULT_REWARD_XP = 1;

function normalizeOption(option) {
  if (
    option === null ||
    option === undefined
  ) {
    return null;
  }

  const value = String(option)
    .trim()
    .toUpperCase();

  if (
    !["A", "B", "C", "D"].includes(value)
  ) {
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
  if (
    !value ||
    typeof value !== "object"
  ) {
    return {
      credit: DEFAULT_REWARD_CREDIT,
      xp: DEFAULT_REWARD_XP,
    };
  }

  const credit =
    Number(value.credit);

  const xp =
    Number(value.xp);

  return {
    credit:
      Number.isFinite(credit) &&
      credit >= 0
        ? credit
        : DEFAULT_REWARD_CREDIT,

    xp:
      Number.isInteger(xp) &&
      xp >= 0
        ? xp
        : DEFAULT_REWARD_XP,
  };
}

async function getQuizConfig() {
  const gameType =
    await gameService.getGameType(
      QUIZ_GAME_KEY
    );

  const enabled =
    await gameSettingsService.isGameEnabled(
      gameType.id
    );

  if (!enabled) {
    throw new Error(
      "Quiz is disabled"
    );
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
        credit:
          DEFAULT_REWARD_CREDIT,
        xp:
          DEFAULT_REWARD_XP,
      }
    );

  const timeSetting =
    await gameSettingsService.getSetting(
      gameType.id,
      "quiz_time_limit",
      {
        seconds:
          DEFAULT_TIME_LIMIT,
      }
    );

  let timeLimit =
    Number(
      timeSetting?.seconds ??
      timeSetting
    );

  if (
    !Number.isInteger(timeLimit) ||
    timeLimit < 5 ||
    timeLimit > 60
  ) {
    timeLimit =
      DEFAULT_TIME_LIMIT;
  }

  return {
    gameType,

    questionCount:
      Number.isInteger(
        questionCount
      ) &&
      questionCount > 0
        ? questionCount
        : DEFAULT_QUESTION_COUNT,

    reward:
      getRewardValue(
        rewardSetting
      ),

    timeLimit,
  };
}

async function startQuiz({
  userId,
  languageCode = "fa",
}) {
  if (!userId) {
    throw new Error(
      "User ID is required"
    );
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

        pollChatId:
          null,

        pollMessageId:
          null,

        pollSentAt:
          null,

        usedQuestionIds:
          [],

        processing:
          false,
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
    await quizRepository.getRandomQuestion(
      {
        languageCode,

        excludedIds:
          usedQuestionIds,
      }
    );

  if (!question) {
    question =
      await quizRepository.getRandomQuestionAnyLanguage(
        {
          excludedIds:
            usedQuestionIds,
        }
      );
  }

  if (!question) {
    throw new Error(
      "No active quiz questions available"
    );
  }

  const nextMetadata = {
    ...metadata,

    languageCode,

    currentRound:
      nextRound,

    currentQuestionId:
      Number(question.id),

    currentPollId:
      null,

    pollChatId:
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
    questionId,
    sentAt,
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

  const updatedMetadata = {
    ...metadata,

    currentPollId:
      String(pollId),

    currentQuestionId:
      Number(questionId),

    pollChatId:
      Number(chatId),

    pollMessageId:
      Number(messageId),

    pollSentAt:
      sentAt ||
      new Date().toISOString(),

    processing:
      false,
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

async function processAnswer({
  sessionId,
  selectedOption = null,
  timedOut = false,
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

    const reward =
      isCorrect
        ? config.reward
        : {
            credit: 0,
            xp: 0,
          };

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

      pollChatId:
        null,

      pollMessageId:
        null,

      pollSentAt:
        null,

      processing:
        false,
    };

    if (finished) {
      /*
       * هزینه بازی باید قبل از COMMIT و داخل
       * همین تراکنش مصرف شود.
       *
       * بنابراین:
       * پاسخ آخر + reward + مصرف credit +
       * تکمیل session
       * همگی اتمیک هستند.
       */
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

  const selectedOption =
    optionIndexToLetter(
      optionIndex
    );

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
  });
}

async function processTimeout(
  sessionId
) {
  if (!sessionId) {
    return {
      handled: false,

      reason:
        "SESSION_ID_MISSING",
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

  return processAnswer({
    sessionId,

    selectedOption:
      null,

    timedOut:
      true,
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
};
