const { getClient } = require("../database/client");

const REPORT_REASONS = [
  "WRONG_ANSWER",
  "BAD_QUESTION",
  "BAD_OPTIONS",
  "DUPLICATE",
  "UNRELIABLE",
  "OTHER",
];

function normalizeReason(reason) {
  const value = String(reason || "").trim().toUpperCase();

  if (!value) {
    return null;
  }

  return REPORT_REASONS.includes(value) ? value : null;
}

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
  reason = null,
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

  const normalizedReason = normalizeReason(reason);

  const values = [
    safeLimit,
    safeOffset,
  ];

  let reasonCondition = "";

  if (normalizedReason) {
    values.push(normalizedReason);
    reasonCondition = `AND r.reason = $${values.length}`;
  }

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
        ${reasonCondition}
      ORDER BY r.created_at ASC
      LIMIT $1 OFFSET $2
    `,
    values
  );

  return result.rows;
}

async function countPendingReports({
  reason = null,
} = {}) {
  const db = getClient();

  const normalizedReason = normalizeReason(reason);

  const values = [];
  let reasonCondition = "";

  if (normalizedReason) {
    values.push(normalizedReason);
    reasonCondition = `AND reason = $${values.length}`;
  }

  const result = await db.query(
    `
      SELECT COUNT(*)::INTEGER AS count
      FROM quiz_question_reports
      WHERE status = 'PENDING'
        ${reasonCondition}
    `,
    values
  );

  return Number(result.rows[0]?.count || 0);
}

async function countPendingReportsByReason() {
  const db = getClient();

  const result = await db.query(`
    WITH reasons(reason) AS (
      VALUES
        ('WRONG_ANSWER'),
        ('BAD_QUESTION'),
        ('BAD_OPTIONS'),
        ('DUPLICATE'),
        ('UNRELIABLE'),
        ('OTHER')
    )
    SELECT
      reasons.reason,
      COUNT(r.id)::INTEGER AS count
    FROM reasons
    LEFT JOIN quiz_question_reports r
      ON r.reason = reasons.reason
      AND r.status = 'PENDING'
    GROUP BY reasons.reason
  `);

  return result.rows;
}

async function getReportById(reportId) {
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

  const normalizedStatus = String(status)
    .trim()
    .toUpperCase();

  if (!allowedStatuses.includes(normalizedStatus)) {
    throw new Error("Invalid report status");
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
      normalizedStatus,
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
  countPendingReportsByReason,
  getReportById,
  resolveReport,
};
