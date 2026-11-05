
"use strict";

const { getClient } = require("../database/client");

/**
 * ایجاد یک سؤال جدید توسط ادمین
 */
async function createQuestion({
  languageCode = "fa",
  category,
  difficulty,
  questionText,
  optionA,
  optionB,
  optionC,
  optionD,
  correctOption,
  explanation = null,
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
        status
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        'ACTIVE'
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
    ]
  );

  return result.rows[0] || null;
}

/**
 * واردکردن گروهی سؤال‌ها از سایت
 *
 * امکانات:
 * - حداکثر ۱۰۰ سؤال در هر درخواست
 * - بررسی اعتبار سؤال و گزینه‌ها
 * - رد سؤال‌های بدون پاسخ صحیح
 * - شناسایی سؤال‌های تکراری
 * - ثبت گروهی در یک تراکنش
 * - جلوگیری از تداخل ثبت هم‌زمان
 * - بازگرداندن آمار ثبت، تکراری و نامعتبر
 */
async function importQuestions({
  questions,
  languageCode = "fa",
  category,
  categoryId,
  difficulty,
}) {
  if (
    !Array.isArray(questions) ||
    questions.length === 0
  ) {
    throw new Error("Questions list is empty");
  }

  if (questions.length > 100) {
    throw new Error(
      "Maximum 100 questions can be imported at once"
    );
  }

  if (
    typeof category !== "string" ||
    !category.trim()
  ) {
    throw new Error("Invalid quiz category");
  }

  const normalizedDifficulty = String(
    difficulty || ""
  ).trim().toUpperCase();

  if (
    !["EASY", "MEDIUM", "HARD"].includes(
      normalizedDifficulty
    )
  ) {
    throw new Error("Invalid quiz difficulty");
  }

  const normalizedCategoryId = Number(categoryId);

  if (
    !Number.isInteger(normalizedCategoryId) ||
    normalizedCategoryId <= 0
  ) {
    throw new Error("Invalid category ID");
  }

  const db = getClient();
  const client = await db.connect();

  const result = {
    inserted: 0,
    duplicates: 0,
    invalid: 0,
    questions: [],
  };

  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // جلوگیری از ثبت هم‌زمان سؤال‌های تکراری
    await client.query(
      `
        LOCK TABLE quiz_questions
        IN SHARE ROW EXCLUSIVE MODE
      `
    );

    const normalizedQuestions = [];

    for (const question of questions) {
      if (!question || typeof question !== "object") {
        result.invalid++;
        continue;
      }

      const questionText = String(
        question.questionText || ""
      ).trim();

      const options = [
        question.optionA,
        question.optionB,
        question.optionC,
        question.optionD,
      ].map((value) => String(value || "").trim());

      const correctOption = String(
        question.correctOption || ""
      ).trim().toUpperCase();

      const valid =
        questionText.length >= 5 &&
        questionText.length <= 2000 &&
        options.every(
          (option) =>
            option.length > 0 &&
            option.length <= 500
        ) &&
        new Set(options).size === 4 &&
        ["A", "B", "C", "D"].includes(
          correctOption
        );

      if (!valid) {
        result.invalid++;
        continue;
      }

      normalizedQuestions.push({
        questionText,
        optionA: options[0],
        optionB: options[1],
        optionC: options[2],
        optionD: options[3],
        correctOption,
        explanation: question.explanation
          ? String(question.explanation)
              .trim()
              .slice(0, 2000)
          : null,
      });
    }

    for (const question of normalizedQuestions) {
      const normalizedText = question.questionText
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

      // بررسی تکراری بودن سؤال
      const existing = await client.query(
        `
          SELECT id
          FROM quiz_questions
          WHERE LOWER(
            REGEXP_REPLACE(
              BTRIM(question_text),
              '\\s+',
              ' ',
              'g'
            )
          ) = $1
          LIMIT 1
        `,
        [normalizedText]
      );

      if (existing.rows.length > 0) {
        result.duplicates++;
        continue;
      }

      // ثبت سؤال جدید
      const inserted = await client.query(
        `
          INSERT INTO quiz_questions (
            language_code,
            category,
            category_id,
            difficulty,
            question_text,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_option,
            explanation,
            status
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, 'ACTIVE'
          )
          RETURNING id
        `,
        [
          languageCode,
          category,
          normalizedCategoryId,
          normalizedDifficulty,
          question.questionText,
          question.optionA,
          question.optionB,
          question.optionC,
          question.optionD,
          question.correctOption,
          question.explanation,
        ]
      );

      if (inserted.rows[0]) {
        result.inserted++;

        result.questions.push(
          inserted.rows[0].id
        );
      }
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Quiz import rollback failed:",
          rollbackError
        );
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

/**
 * شمارش سؤال‌های فعال
 */
async function countActiveQuestions() {
  const db = getClient();

  const result = await db.query(
    `
      SELECT COUNT(*)::INTEGER AS count
      FROM quiz_questions
      WHERE status = 'ACTIVE'
    `
  );

  return Number(result.rows[0]?.count || 0);
}

/**
 * دریافت سؤال با شناسه
 */
async function getQuestionById(questionId) {
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

/**
 * دریافت فهرست سؤال‌ها
 */
async function listQuestions({
  search = "",
  status = "ALL",
  categoryId = null,
  limit = 10,
  offset = 0,
} = {}) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 10, 50)
  );

  const safeOffset = Math.max(
    0,
    Number(offset) || 0
  );

  const values = [];
  const conditions = [];

  if (status && status !== "ALL") {
    values.push(
      String(status).trim().toUpperCase()
    );

    conditions.push(
      `qq.status = $${values.length}`
    );
  }

  if (
    categoryId !== null &&
    categoryId !== undefined &&
    Number.isInteger(Number(categoryId)) &&
    Number(categoryId) > 0
  ) {
    values.push(Number(categoryId));

    conditions.push(
      `qq.category_id = $${values.length}`
    );
  }

  if (search && String(search).trim()) {
    values.push(
      `%${String(search).trim()}%`
    );

    const index = values.length;

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

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  values.push(safeLimit);
  const limitIndex = values.length;

  values.push(safeOffset);
  const offsetIndex = values.length;

  const result = await db.query(
    `
      SELECT qq.*
      FROM quiz_questions qq
      ${whereClause}
      ORDER BY qq.id DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `,
    values
  );

  return result.rows;
}

/**
 * شمارش سؤال‌ها با فیلتر
 */
async function countQuestions({
  search = "",
  status = "ALL",
  categoryId = null,
} = {}) {
  const db = getClient();

  const values = [];
  const conditions = [];

  if (status && status !== "ALL") {
    values.push(
      String(status).trim().toUpperCase()
    );

    conditions.push(
      `qq.status = $${values.length}`
    );
  }

  if (
    categoryId !== null &&
    categoryId !== undefined &&
    Number.isInteger(Number(categoryId)) &&
    Number(categoryId) > 0
  ) {
    values.push(Number(categoryId));

    conditions.push(
      `qq.category_id = $${values.length}`
    );
  }

  if (search && String(search).trim()) {
    values.push(
      `%${String(search).trim()}%`
    );

    const index = values.length;

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

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await db.query(
    `
      SELECT COUNT(*)::INTEGER AS count
      FROM quiz_questions qq
      ${whereClause}
    `,
    values
  );

  return Number(result.rows[0]?.count || 0);
}

/**
 * ویرایش سؤال
 */
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
        explanation = $10
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
    ]
  );

  return result.rows[0] || null;
}

/**
 * فعال یا غیرفعال کردن سؤال
 */
async function updateQuestionStatus({
  questionId,
  status,
}) {
  const db = getClient();

  const normalizedStatus = String(status || "")
    .trim()
    .toUpperCase();

  if (
    !["ACTIVE", "INACTIVE"].includes(
      normalizedStatus
    )
  ) {
    throw new Error("Invalid question status");
  }

  const result = await db.query(
    `
      UPDATE quiz_questions
      SET status = $2
      WHERE id = $1
      RETURNING *
    `,
    [
      questionId,
      normalizedStatus,
    ]
  );

  return result.rows[0] || null;
}

/**
 * دریافت دسته‌بندی‌ها
 */
async function listCategories() {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        id,
        name_fa,
        name_en,
        slug
      FROM quiz_categories
      ORDER BY name_fa ASC
    `
  );

  return result.rows;
}

module.exports = {
  createQuestion,
  importQuestions,
  countActiveQuestions,
  getQuestionById,
  listQuestions,
  countQuestions,
  listCategories,
  updateQuestion,
  updateQuestionStatus,
};
