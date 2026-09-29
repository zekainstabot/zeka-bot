const { getClient } = require("../database/client");

async function createReport({
  questionId,
  userId,
  reason,
  details = null,
}) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO quiz_question_reports (
        question_id,
        user_id,
        reason,
        details
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
      RETURNING *
    `,
    [
      questionId,
      userId,
      reason,
      details,
    ]
  );

  return result.rows[0] || null;
}

async function listPendingReports({
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

  const result = await db.query(
    `
      SELECT
        r.*,

        qq.question_text,
        qq.option_a,
        qq.option_b,
        qq.option_c,
        qq.option_d,
        qq.correct_option,
        qq.explanation,
        qq.category,
        qq.difficulty,
        qq.status AS question_status,

        u.telegram_user_id,
        u.username

      FROM quiz_question_reports r

      INNER JOIN quiz_questions qq
        ON qq.id = r.question_id

      INNER JOIN users u
        ON u.id = r.user_id

      WHERE r.status = 'PENDING'

      ORDER BY
        r.created_at ASC

      LIMIT $1
      OFFSET $2
    `,
    [
      safeLimit,
      safeOffset,
    ]
  );

  return result.rows;
}

async function countPendingReports() {
  const db = getClient();

  const result = await db.query(
    `
      SELECT COUNT(*)::INTEGER AS count
      FROM quiz_question_reports
      WHERE status = 'PENDING'
    `
  );

  return Number(
    result.rows[0]?.count || 0
  );
}

async function getReportById(
  reportId
) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        r.*,

        qq.question_text,
        qq.option_a,
        qq.option_b,
        qq.option_c,
        qq.option_d,
        qq.correct_option,
        qq.explanation,
        qq.category,
        qq.difficulty,
        qq.status AS question_status,

        u.telegram_user_id,
        u.username

      FROM quiz_question_reports r

      INNER JOIN quiz_questions qq
        ON qq.id = r.question_id

      INNER JOIN users u
        ON u.id = r.user_id

      WHERE r.id = $1

      LIMIT 1
    `,
    [reportId]
  );

  return result.rows[0] || null;
}

async function resolveReport(
  reportId,
  status,
  reviewedBy,
  adminNote = null
) {
  const db = getClient();

  const allowedStatuses = [
    "RESOLVED",
    "REJECTED",
  ];

  if (
    !allowedStatuses.includes(
      String(status)
        .trim()
        .toUpperCase()
    )
  ) {
    throw new Error(
      "Invalid report status"
    );
  }

  const result = await db.query(
    `
      UPDATE quiz_question_reports

      SET
        status = $2,
        reviewed_by = $3,
        reviewed_at = NOW(),
        admin_note = $4,
        updated_at = NOW()

      WHERE id = $1
        AND status = 'PENDING'

      RETURNING *
    `,
    [
      reportId,
      String(status)
        .trim()
        .toUpperCase(),
      reviewedBy,
      adminNote,
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  createReport,
  listPendingReports,
  countPendingReports,
  getReportById,
  resolveReport,
};
