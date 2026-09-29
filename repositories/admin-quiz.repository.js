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

module.exports = {
  createQuestion,
  countActiveQuestions,
  getQuestionById,
  updateQuestion,
};
