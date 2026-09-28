const { getClient } = require("../database/client");

function getDb(client = null) {
  return client || getClient();
}

async function getRandomQuestion(
  {
    languageCode = "fa",
    excludedIds = [],
  } = {},
  client = null
) {
  const db = getDb(client);

  const safeExcludedIds = Array.isArray(excludedIds)
    ? excludedIds
        .map(Number)
        .filter(
          (id) =>
            Number.isSafeInteger(id) &&
            id > 0
        )
    : [];

  const values = [languageCode];

  let exclusionSql = "";

  if (safeExcludedIds.length > 0) {
    const placeholders = safeExcludedIds.map(
      (_, index) => `$${index + 2}`
    );

    exclusionSql = `
      AND id NOT IN (${placeholders.join(", ")})
    `;

    values.push(...safeExcludedIds);
  }

  const result = await db.query(
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
        ${exclusionSql}
      ORDER BY RANDOM()
      LIMIT 1
    `,
    values
  );

  return result.rows[0] || null;
}

async function getRandomQuestionAnyLanguage(
  {
    excludedIds = [],
  } = {},
  client = null
) {
  const db = getDb(client);

  const safeExcludedIds = Array.isArray(excludedIds)
    ? excludedIds
        .map(Number)
        .filter(
          (id) =>
            Number.isSafeInteger(id) &&
            id > 0
        )
    : [];

  const values = [];
  let exclusionSql = "";

  if (safeExcludedIds.length > 0) {
    const placeholders = safeExcludedIds.map(
      (_, index) => `$${index + 1}`
    );

    exclusionSql = `
      AND id NOT IN (${placeholders.join(", ")})
    `;

    values.push(...safeExcludedIds);
  }

  const result = await db.query(
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
        ${exclusionSql}
      ORDER BY RANDOM()
      LIMIT 1
    `,
    values
  );

  return result.rows[0] || null;
}

async function getQuestionById(
  questionId,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
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
        explanation,
        status
      FROM quiz_questions
      WHERE id = $1
      LIMIT 1
    `,
    [questionId]
  );

  return result.rows[0] || null;
}

async function createAnswer(
  {
    sessionId,
    playerId,
    questionId,
    roundNumber,
    selectedOption = null,
    isCorrect = null,
    responseTimeMs = null,
    creditReward = 0,
    xpReward = 0,
    metadata = {},
  },
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
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
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10::JSONB
      )
      ON CONFLICT (
        player_id,
        round_number
      )
      DO NOTHING
      RETURNING *
    `,
    [
      sessionId,
      playerId,
      questionId,
      roundNumber,
      selectedOption,
      isCorrect,
      responseTimeMs,
      creditReward,
      xpReward,
      JSON.stringify(metadata || {}),
    ]
  );

  return result.rows[0] || null;
}

async function getAnswerByRound(
  playerId,
  roundNumber,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT *
      FROM game_answers
      WHERE player_id = $1
        AND round_number = $2
      LIMIT 1
    `,
    [
      playerId,
      roundNumber,
    ]
  );

  return result.rows[0] || null;
}

async function getAnswersBySession(
  sessionId,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT
        ga.*,
        qq.question_text,
        qq.correct_option,
        qq.explanation
      FROM game_answers ga
      LEFT JOIN quiz_questions qq
        ON qq.id = ga.question_id
      WHERE ga.session_id = $1
      ORDER BY ga.round_number ASC
    `,
    [sessionId]
  );

  return result.rows;
}

async function getPlayer(
  sessionId,
  userId,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
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

async function createPlayer(
  {
    sessionId,
    userId,
    playerNumber = 1,
    reservedCost = 0,
  },
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
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
        $3,
        'ACTIVE',
        $4
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
      playerNumber,
      reservedCost,
    ]
  );

  return result.rows[0];
}

async function updatePlayerStats(
  playerId,
  {
    score,
    creditReward,
    xpEarned,
    status,
  },
  client = null
) {
  const db = getDb(client);

  const fields = [];
  const values = [playerId];
  let index = 2;

  if (score !== undefined) {
    fields.push(`score = $${index}`);
    values.push(score);
    index++;
  }

  if (creditReward !== undefined) {
    fields.push(
      `credit_reward = $${index}`
    );
    values.push(creditReward);
    index++;
  }

  if (xpEarned !== undefined) {
    fields.push(
      `xp_earned = $${index}`
    );
    values.push(xpEarned);
    index++;
  }

  if (status !== undefined) {
    fields.push(`status = $${index}`);
    values.push(status);
    index++;
  }

  if (fields.length === 0) {
    return getPlayer(
      null,
      null,
      client
    );
  }

  const result = await db.query(
    `
      UPDATE game_session_players
      SET
        ${fields.join(", ")}
      WHERE id = $1
      RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}

module.exports = {
  getRandomQuestion,
  getRandomQuestionAnyLanguage,
  getQuestionById,
  createAnswer,
  getAnswerByRound,
  getAnswersBySession,
  getPlayer,
  createPlayer,
  updatePlayerStats,
};
