const { getClient } = require("../database/client");

async function createQuestion({
  languageCode,
  category,
  difficulty,
  questionText,
  optionA,
  optionB,
  optionC,
  optionD,
  correctOption,
  explanation = null,
  createdBy,
}) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO quiz_questions (
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
        status,
        source_type,
        created_by,
        updated_by
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
        $10,
        'ACTIVE',
        'ADMIN',
        $11,
        $11
      )
      RETURNING *
    `,
    [
      languageCode,
      category,
      difficulty,
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      explanation,
      createdBy,
    ]
  );

  return result.rows[0] || null;
}

async function countActiveQuestions() {
  const db = getClient();

  const result = await db.query(
    `
      SELECT COUNT(*)::INTEGER AS count
      FROM quiz_questions
      WHERE status = 'ACTIVE'
    `
  );

  return Number(
    result.rows[0]?.count || 0
  );
}

async function getQuestionById(
  questionId
) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM quiz_questions
      WHERE id = $1
      LIMIT 1
    `,
    [questionId]
  );

  return result.rows[0] || null;
}

async function listQuestions({
  search = "",
  status = "ALL",
  category = null,
  limit = 10,
  offset = 0,
} = {}) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(
      Number(limit) || 10,
      50
    )
  );

  const safeOffset = Math.max(
    0,
    Number(offset) || 0
  );

  const values = [];
  const conditions = [];

  if (
    status &&
    status !== "ALL"
  ) {
    values.push(
      String(status)
        .trim()
        .toUpperCase()
    );

    conditions.push(
      `qq.status = $${values.length}`
    );
  }

  if (
    category &&
    String(category).trim()
  ) {
    values.push(
      String(category).trim()
    );

    conditions.push(
      `qq.category = $${values.length}`
    );
  }

  if (
    search &&
    String(search).trim()
  ) {
    const searchValue =
      `%${String(search).trim()}%`;

    values.push(searchValue);

    const index =
      values.length;

    conditions.push(`
      (
        qq.question_text ILIKE $${index}
        OR qq.option_a ILIKE $${index}
        OR qq.option_b ILIKE $${index}
        OR qq.option_c ILIKE $${index}
        OR qq.option_d ILIKE $${index}
        OR CAST(qq.id AS TEXT) = $${index}
      )
    `);
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(
          " AND "
        )}`
      : "";

  values.push(safeLimit);
  const limitIndex =
    values.length;

  values.push(safeOffset);
  const offsetIndex =
    values.length;

  const result = await db.query(
    `
      SELECT
        qq.*
      FROM quiz_questions qq
      ${whereClause}
      ORDER BY
        qq.id DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `,
    values
  );

  return result.rows;
}

async function countQuestions({
  search = "",
  status = "ALL",
  category = null,
} = {}) {
  const db = getClient();

  const values = [];
  const conditions = [];

  if (
    status &&
    status !== "ALL"
  ) {
    values.push(
      String(status)
        .trim()
        .toUpperCase()
    );

    conditions.push(
      `qq.status = $${values.length}`
    );
  }

  if (
    category &&
    String(category).trim()
  ) {
    values.push(
      String(category).trim()
    );

    conditions.push(
      `qq.category = $${values.length}`
    );
  }

  if (
    search &&
    String(search).trim()
  ) {
    const searchValue =
      `%${String(search).trim()}%`;

    values.push(searchValue);

    const index =
      values.length;

    conditions.push(`
      (
        qq.question_text ILIKE $${index}
        OR qq.option_a ILIKE $${index}
        OR qq.option_b ILIKE $${index}
        OR qq.option_c ILIKE $${index}
        OR qq.option_d ILIKE $${index}
        OR CAST(qq.id AS TEXT) = $${index}
      )
    `);
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(
          " AND "
        )}`
      : "";

  const result = await db.query(
    `
      SELECT
        COUNT(*)::INTEGER AS count
      FROM quiz_questions qq
      ${whereClause}
    `,
    values
  );

  return Number(
    result.rows[0]?.count || 0
  );
}

async function updateQuestion({
  questionId,
  category,
  difficulty,
  questionText,
  optionA,
  optionB,
  optionC,
  optionD,
  correctOption,
  explanation = null,
  updatedBy,
}) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE quiz_questions
      SET
        category = $2,
        difficulty = $3,
        question_text = $4,
        option_a = $5,
        option_b = $6,
        option_c = $7,
        option_d = $8,
        correct_option = $9,
        explanation = $10,
        updated_by = $11,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      questionId,
      category,
      difficulty,
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      explanation,
      updatedBy,
    ]
  );

  return result.rows[0] || null;
}

async function updateQuestionStatus({
  questionId,
  status,
  updatedBy,
}) {
  const db = getClient();

  const normalizedStatus =
    String(status || "")
      .trim()
      .toUpperCase();

  if (
    ![
      "ACTIVE",
      "INACTIVE",
    ].includes(
      normalizedStatus
    )
  ) {
    throw new Error(
      "Invalid question status"
    );
  }

  const result = await db.query(
    `
      UPDATE quiz_questions
      SET
        status = $2,
        updated_by = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      questionId,
      normalizedStatus,
      updatedBy,
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  createQuestion,
  countActiveQuestions,
  getQuestionById,
  listQuestions,
  countQuestions,
  updateQuestion,
  updateQuestionStatus,
};
