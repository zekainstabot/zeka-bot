const { getPool } = require("../../database/pool");
const gameService = require("../game.service");
const gameSettingsService = require("../game-settings.service");
const gameRepository = require("../../repositories/game.repository");
const rewardService = require("../../services/reward.service");

const QUIZ_GAME_KEY = "quiz_general";
const DEFAULT_TIME_LIMIT = 10;
const DEFAULT_QUESTION_COUNT = 10;
const DEFAULT_REWARD_CREDIT = 0.5;
const DEFAULT_REWARD_XP = 1;

function normalizeOption(option) {
  if (option === null || option === undefined) {
    return null;
  }

  const value = String(option).trim().toUpperCase();

  if (!["A", "B", "C", "D"].includes(value)) {
    return null;
  }

  return value;
}

function optionIndexToLetter(index) {
  const numericIndex = Number(index);

  if (
    !Number.isInteger(numericIndex) ||
    numericIndex < 0 ||
    numericIndex > 3
  ) {
    return null;
  }

  return ["A", "B", "C", "D"][numericIndex];
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
    await gameService.getGameType(
      QUIZ_GAME_KEY
    );

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
    timeLimit = DEFAULT_TIME_LIMIT;
  }

  return {
    gameType,
    questionCount:
      Number.isInteger(questionCount) &&
      questionCount > 0
        ? questionCount
        : DEFAULT_QUESTION_COUNT,

    reward:
      getRewardValue(rewardSetting),

    timeLimit,
  };
}

async function getRandomQuestion({
  languageCode = "fa",
  usedQuestionIds = [],
}) {
  const pool = getPool();

  const safeIds = Array.isArray(
    usedQuestionIds
  )
    ? usedQuestionIds
        .map(Number)
        .filter(
          (id) =>
            Number.isSafeInteger(id) &&
            id > 0
        )
    : [];

  const values = [languageCode];

  let excludeSql = "";

  if (safeIds.length > 0) {
    const placeholders = safeIds.map(
      (_, index) =>
        `$${index + 2}`
    );

    excludeSql = `
      AND id NOT IN (${placeholders.join(", ")})
    `;

    values.push(...safeIds);
  }

  let result = await pool.query(
    `
      SELECT
        id,
        language_code,
        category,
        difficulty,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option,
        explanation
      FROM quiz_questions
      WHERE status = 'ACTIVE'
        AND language_code = $1
        ${excludeSql}
      ORDER BY RANDOM()
      LIMIT 1
    `,
    values
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  /*
   * اگر سؤال فارسی کافی نبود، از هر سؤال فعال استفاده می‌کنیم.
   * این باعث نمی‌شود مسابقه صرفاً به خاطر کمبود سؤال فارسی خراب شود.
   */
  if (safeIds.length > 0) {
    result = await pool.query(
      `
        SELECT
          id,
          language_code,
          category,
          difficulty,
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_option,
          explanation
        FROM quiz_questions
        WHERE status = 'ACTIVE'
          AND id NOT IN (
            ${safeIds
              .map(
                (_, index) =>
                  `$${index + 1}`
              )
              .join(", ")}
          )
        ORDER BY RANDOM()
        LIMIT 1
      `,
      safeIds
    );
  } else {
    result = await pool.query(
      `
        SELECT
          id,
          language_code,
          category,
          difficulty,
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_option,
          explanation
        FROM quiz_questions
        WHERE status = 'ACTIVE'
        ORDER BY RANDOM()
        LIMIT 1
      `
    );
  }

  return result.rows[0] || null;
}

async function createPlayer(
  sessionId,
  userId,
  client = null
) {
  const db = client || getPool();

  const queryClient =
    client || db;

  const result =
    await queryClient.query(
      `
        INSERT INTO game_session_players (
          session_id,
          user_id,
          player_number,
          status,
          reserved_cost
        )
        VALUES (
          $1,
          $2,
          1,
          'ACTIVE',
          0
        )
        ON CONFLICT (
          session_id,
          user_id
        )
        DO UPDATE SET
          status = 'ACTIVE'
        RETURNING *
      `,
      [
        sessionId,
        userId,
      ]
    );

  return result.rows[0];
}

async function getPlayer(
  sessionId,
  userId,
  client = null
) {
  const db =
    client || getPool();

  const result =
    await db.query(
      `
        SELECT *
        FROM game_session_players
        WHERE session_id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [
        sessionId,
        userId,
      ]
    );

  return result.rows[0] || null;
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
      gameKey: QUIZ_GAME_KEY,
      cost,
      totalRounds:
        config.questionCount,
      metadata: {
        game: QUIZ_GAME_KEY,
        languageCode,
        usedQuestionIds: [],
        currentPollId: null,
        currentQuestionId: null,
        currentRound: 0,
        pollChatId: null,
        pollMessageId: null,
        pollSentAt: null,
      },
    });

  try {
    await createPlayer(
      session.id,
      userId
    );

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
  const config =
    await getQuizConfig();

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

  const metadata =
    session.metadata || {};

  const usedQuestionIds =
    Array.isArray(
      metadata.usedQuestionIds
    )
      ? metadata.usedQuestionIds
      : [];

  const nextRound =
    Number(session.current_round || 0) +
    1;

  if (
    nextRound >
    Number(session.total_rounds || config.questionCount)
  ) {
    return {
      finished: true,
      session,
    };
  }

  const question =
    await getRandomQuestion({
      languageCode,
      usedQuestionIds,
    });

  if (!question) {
    throw new Error(
      "No active quiz questions available"
    );
  }

  const updatedUsedIds = [
    ...usedQuestionIds,
    Number(question.id),
  ];

  const nextMetadata = {
    ...metadata,
    languageCode,
    usedQuestionIds:
      updatedUsedIds,
    currentRound: nextRound,
    currentPollId: null,
    currentQuestionId:
      Number(question.id),
    pollChatId: null,
    pollMessageId: null,
    pollSentAt: null,
  };

  const updatedSession =
    await gameRepository.updateSession(
      session.id,
      {
        current_round: nextRound,
        metadata: nextMetadata,
      }
    );

  return {
    finished: false,
    session: updatedSession,
    question,
    config,
    round: nextRound,
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
  };

  return gameRepository.updateSession(
    sessionId,
    {
      metadata: updatedMetadata,
    }
  );
}

async function findSessionByPollId(
  pollId
) {
  if (!pollId) {
    return null;
  }

  const pool = getPool();

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
      [String(pollId)]
    );

  return result.rows[0] || null;
}

async function recordAnswer({
  pollId,
  telegramUserId,
  selectedOption,
}) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query(
      "BEGIN"
    );

    const sessionResult =
      await client.query(
        `
          SELECT *
          FROM game_sessions
          WHERE status = 'ACTIVE'
            AND metadata->>'currentPollId' = $1
          LIMIT 1
          FOR UPDATE
        `,
        [String(pollId)]
      );

    const session =
      sessionResult.rows[0];

    if (!session) {
      await client.query(
        "ROLLBACK"
      );

      return {
        handled: false,
        reason: "SESSION_NOT_FOUND",
      };
    }

    const userResult =
      await client.query(
        `
          SELECT id
          FROM users
          WHERE telegram_user_id = $1
          LIMIT 1
        `,
        [telegramUserId]
      );

    const user =
      userResult.rows[0];

    if (
      !user ||
      Number(user.id) !==
        Number(session.user_id)
    ) {
      await client.query(
        "ROLLBACK"
      );

      return {
        handled: false,
        reason: "USER_MISMATCH",
      };
    }

    const metadata =
      session.metadata || {};

    const round =
      Number(
        metadata.currentRound ||
        session.current_round ||
        1
      );

    const questionId =
      Number(
        metadata.currentQuestionId
      );

    const player =
      await getPlayer(
        session.id,
        user.id,
        client
      );

    if (!player) {
      throw new Error(
        "Quiz player not found"
      );
    }

    const existingResult =
      await client.query(
        `
          SELECT *
          FROM game_answers
          WHERE player_id = $1
            AND round_number = $2
          LIMIT 1
        `,
        [
          player.id,
          round,
        ]
      );

    if (
      existingResult.rows[0]
    ) {
      await client.query(
        "COMMIT"
      );

      return {
        handled: false,
        reason: "ALREADY_ANSWERED",
        session,
        answer:
          existingResult.rows[0],
      };
    }

    const sentAt =
      metadata.pollSentAt
        ? new Date(
            metadata.pollSentAt
          )
        : null;

    const responseTime =
      sentAt &&
      !Number.isNaN(
        sentAt.getTime()
      )
        ? Math.max(
            0,
            Date.now() -
              sentAt.getTime()
          )
        : null;

    const normalizedOption =
      normalizeOption(
        selectedOption
      );

    const questionResult =
      await client.query(
        `
          SELECT *
          FROM quiz_questions
          WHERE id = $1
          LIMIT 1
        `,
        [questionId]
      );

    const question =
      questionResult.rows[0];

    if (!question) {
      throw new Error(
        "Quiz question not found"
      );
    }

    const isCorrect =
      normalizedOption !== null &&
      normalizedOption ===
        String(
          question.correct_option
        ).toUpperCase();

    const config =
      await getQuizConfig();

    const reward =
      isCorrect
        ? config.reward
        : {
            credit: 0,
            xp: 0,
          };

    const answerResult =
      await client.query(
        `
          INSERT INTO game_answers (
            session_id,
            player_id,
            question_id,
            round_number,
            selected_option,
            is_correct,
            response_time_ms,
            credit_reward,
            xp_reward,
            metadata
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10::JSONB
          )
          RETURNING *
        `,
        [
          session.id,
          player.id,
          question.id,
          round,
          normalizedOption,
          isCorrect,
          responseTime,
          reward.credit,
          reward.xp,
          JSON.stringify({
            timedOut:
              normalizedOption ===
              null,
          }),
        ]
      );

    const answer =
      answerResult.rows[0];

    if (isCorrect) {
      await rewardService.grantRewardInTransaction({
        userId: user.id,
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
      });
    }

    const nextScore =
      Number(
        player.score || 0
      ) +
      (isCorrect ? 1 : 0);

    const nextCreditReward =
      Number(
        player.credit_reward || 0
      ) +
      Number(reward.credit || 0);

    const nextXp =
      Number(
        player.xp_earned || 0
      ) +
      Number(reward.xp || 0);

    await client.query(
      `
        UPDATE game_session_players
        SET
          score = $2,
          credit_reward = $3,
          xp_earned = $4,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        player.id,
        nextScore,
        nextCreditReward,
        nextXp,
      ]
    );

    const isLastRound =
      round >=
      Number(
        session.total_rounds
      );

    let completedSession =
      null;

    if (isLastRound) {
      await client.query(
        `
          UPDATE game_sessions
          SET
            status = 'COMPLETED',
            result = $2::JSONB,
            completed_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `,
        [
          session.id,
          JSON.stringify({
            score: nextScore,
            totalRounds:
              session.total_rounds,
            creditReward:
              nextCreditReward,
            xpReward:
              nextXp,
          }),
        ]
      );

      completedSession =
        await gameRepository.findSessionById(
          session.id,
          client
        );

      /*
       * هزینه رزرو شده را مصرف می‌کنیم.
       * اینجا عمداً داخل همین تراکنش انجام نمی‌دهیم،
       * چون تابع موجود خودش تراکنش مستقل دارد.
       */
    } else {
      const nextMetadata = {
        ...metadata,
        currentPollId: null,
        currentQuestionId: null,
        pollChatId: null,
        pollMessageId: null,
        pollSentAt: null,
      };

      await client.query(
        `
          UPDATE game_sessions
          SET
            metadata = $2::JSONB,
            updated_at = NOW()
          WHERE id = $1
        `,
        [
          session.id,
          JSON.stringify(
            nextMetadata
          ),
        ]
      );
    }

    await client.query(
      "COMMIT"
    );

    if (isLastRound) {
      try {
        await gameService.completeGame(
          session.id,
          {
            score: nextScore,
            totalRounds:
              session.total_rounds,
            creditReward:
              nextCreditReward,
            xpReward:
              nextXp,
          }
        );
      } catch (completeError) {
        console.error(
          `Failed to consume final quiz cost for session ${session.id}:`,
          completeError
        );
      }
    }

    return {
      handled: true,
      correct: isCorrect,
      timedOut:
        normalizedOption === null,
      reward,
      answer,
      session:
        completedSession ||
        session,
      finished:
        isLastRound,
      score: nextScore,
      totalRounds:
        session.total_rounds,
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

async function timeoutCurrentQuestion(
  sessionId
) {
  const session =
    await gameService.getGameSession(
      sessionId
    );

  if (!session) {
    return {
      handled: false,
      reason: "SESSION_NOT_FOUND",
    };
  }

  const metadata =
    session.metadata || {};

  if (!metadata.currentPollId) {
    return {
      handled: false,
      reason: "NO_ACTIVE_POLL",
    };
  }

  return recordAnswer({
    pollId:
      metadata.currentPollId,
    telegramUserId:
      null,
    selectedOption: null,
    allowSystemTimeout: true,
    sessionId,
  });
}

module.exports = {
  QUIZ_GAME_KEY,
  getQuizConfig,
  getRandomQuestion,
  startQuiz,
  prepareNextQuestion,
  registerPoll,
  findSessionByPollId,
  recordAnswer,
  timeoutCurrentQuestion,
};
