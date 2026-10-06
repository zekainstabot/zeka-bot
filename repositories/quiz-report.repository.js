const { getClient } = require("../database/client");

const REPORT_REASONS = {
  WRONG_ANSWER: "WRONG_ANSWER",
  BAD_QUESTION: "BAD_QUESTION",
  BAD_OPTIONS: "BAD_OPTIONS",
  DUPLICATE: "DUPLICATE",
  UNRELIABLE: "UNRELIABLE",
  OTHER: "OTHER",
};

function normalizeReason(reason) {
  const value = String(reason || "")
    .trim()
    .toUpperCase();

  if (!value) {
    return null;
  }

  if (
    !Object.values(REPORT_REASONS).includes(
      value
    )
  ) {
    throw new Error(
      "Invalid report reason"
    );
  }

  return value;
}

function normalizeStatus(status) {
  const value = String(status || "")
    .trim()
    .toUpperCase();

  const allowed = [
    "PENDING",
    "UNREVIEWED",
    "REVIEWED",
    "REJECTED",
  ];

  if (!allowed.includes(value)) {
    throw new Error(
      "Invalid report status"
    );
  }

  return value;
}

async function createReport({
  questionId,
  userId,
  reason,
  details = null,
}) {
  const db = getClient();

  const normalizedReason =
    normalizeReason(reason);

  if (!normalizedReason) {
    throw new Error(
      "Invalid report reason"
    );
  }

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
      normalizedReason,
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
    Math.min(
      Number(limit) || 10,
      50
    )
  );

  const safeOffset = Math.max(
    0,
    Number(offset) || 0
  );

  const normalizedReason =
    normalizeReason(reason);

  const params = [
    safeLimit,
    safeOffset,
  ];

  let reasonCondition = "";

  if (normalizedReason) {
    params.push(normalizedReason);

    reasonCondition =
      `AND r.reason = $${params.length}`;
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

      ORDER BY
        r.created_at ASC,
        r.id ASC

      LIMIT $1
      OFFSET $2
    `,
    params
  );

  return result.rows;
}

async function listReportsByStatus(
  status,
  {
    limit = 10,
    offset = 0,
  } = {}
) {
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

  const normalizedStatus =
    normalizeStatus(status);

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

      WHERE r.status = $1

      ORDER BY
        r.created_at DESC,
        r.id DESC

      LIMIT $2
      OFFSET $3
    `,
    [
      normalizedStatus,
      safeLimit,
      safeOffset,
    ]
  );

  return result.rows;
}

async function listReviewedArchive({
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

      WHERE r.status IN (
        'REVIEWED',
        'REJECTED'
      )

      ORDER BY
        r.created_at DESC,
        r.id DESC

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

async function countPendingReports({
  reason = null,
} = {}) {
  const db = getClient();

  const normalizedReason =
    normalizeReason(reason);

  const params = [];
  let reasonCondition = "";

  if (normalizedReason) {
    params.push(normalizedReason);

    reasonCondition =
      `AND reason = $${params.length}`;
  }

  const result = await db.query(
    `
      SELECT COUNT(*)::INTEGER AS count

      FROM quiz_question_reports

      WHERE status = 'PENDING'
        ${reasonCondition}
    `,
    params
  );

  return Number(
    result.rows[0]?.count || 0
  );
}

async function countByStatus(status) {
  const db = getClient();

  const normalizedStatus =
    normalizeStatus(status);

  const result = await db.query(
    `
      SELECT COUNT(*)::INTEGER AS count

      FROM quiz_question_reports

      WHERE status = $1
    `,
    [normalizedStatus]
  );

  return Number(
    result.rows[0]?.count || 0
  );
}

async function countReviewedArchive() {
  const db = getClient();

  const result = await db.query(
    `
      SELECT COUNT(*)::INTEGER AS count

      FROM quiz_question_reports

      WHERE status IN (
        'REVIEWED',
        'REJECTED'
      )
    `
  );

  return Number(
    result.rows[0]?.count || 0
  );
}

async function countPendingReportsByReason() {
  const db = getClient();

  const result = await db.query(
    `
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

      GROUP BY
        reasons.reason

      ORDER BY
        reasons.reason
    `
  );

  return result.rows;
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

  const normalizedStatus =
    String(status || "")
      .trim()
      .toUpperCase();

  if (
    ![
      "RESOLVED",
      "REJECTED",
    ].includes(normalizedStatus)
  ) {
    throw new Error(
      "Invalid report status"
    );
  }

  const archiveStatus =
    normalizedStatus === "RESOLVED"
      ? "REVIEWED"
      : "REJECTED";

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
      archiveStatus,
      reviewedBy,
      adminNote,
    ]
  );

  return result.rows[0] || null;
}

async function markReviewed(
  reportId,
  reviewedBy,
  adminNote = null
) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE quiz_question_reports

      SET
        status = 'REVIEWED',
        reviewed_by = $2,
        reviewed_at = NOW(),
        admin_note = COALESCE(
          $3,
          admin_note
        ),
        updated_at = NOW()

      WHERE id = $1
        AND status IN (
          'PENDING',
          'UNREVIEWED'
        )

      RETURNING *
    `,
    [
      reportId,
      reviewedBy,
      adminNote,
    ]
  );

  return result.rows[0] || null;
}

async function restoreToPending(
  reportId
) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE quiz_question_reports

      SET
        status = 'PENDING',
        reviewed_by = NULL,
        reviewed_at = NULL,
        updated_at = NOW()

      WHERE id = $1
        AND status IN (
          'REVIEWED',
          'REJECTED'
        )

      RETURNING *
    `,
    [reportId]
  );

  return result.rows[0] || null;
}

async function deleteById(
  reportId
) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM quiz_question_reports

      WHERE id = $1

      RETURNING id
    `,
    [reportId]
  );

  return result.rows[0] || null;
}

async function moveExpiredPendingToUnreviewed(
  reviewDeadlineDays = 3
) {
  const db = getClient();

  const safeDays = Math.max(
    1,
    Math.min(
      Number(reviewDeadlineDays) || 3,
      30
    )
  );

  const result = await db.query(
    `
      UPDATE quiz_question_reports

      SET
        status = 'UNREVIEWED',
        updated_at = NOW()

      WHERE status = 'PENDING'
        AND created_at <
          NOW() - (
            $1::int * INTERVAL '1 day'
          )

      RETURNING id
    `,
    [safeDays]
  );

  return result.rowCount || 0;
}

async function cleanupArchivedReports(
  retentionDays = 7,
  maxPerArchive = 100
) {
  const db = getClient();

  const safeRetentionDays = Math.max(
    1,
    Math.min(
      Number(retentionDays) || 7,
      365
    )
  );

  const safeMaxPerArchive = Math.max(
    1,
    Math.min(
      Number(maxPerArchive) || 100,
      1000
    )
  );

  const expiredResult = await db.query(
    `
      DELETE FROM quiz_question_reports

      WHERE created_at <
        NOW() - (
          $1::int * INTERVAL '1 day'
        )

        AND status IN (
          'REVIEWED',
          'REJECTED',
          'UNREVIEWED'
        )
    `,
    [safeRetentionDays]
  );

  const reviewedOverflowResult =
    await db.query(
      `
        DELETE FROM quiz_question_reports

        WHERE id IN (
          SELECT id

          FROM quiz_question_reports

          WHERE status IN (
            'REVIEWED',
            'REJECTED'
          )

          ORDER BY
            created_at DESC,
            id DESC

          OFFSET $1
        )
      `,
      [safeMaxPerArchive]
    );

  const unreviewedOverflowResult =
    await db.query(
      `
        DELETE FROM quiz_question_reports

        WHERE id IN (
          SELECT id

          FROM quiz_question_reports

          WHERE status = 'UNREVIEWED'

          ORDER BY
            created_at DESC,
            id DESC

          OFFSET $1
        )
      `,
      [safeMaxPerArchive]
    );

  return {
    expiredCount:
      expiredResult.rowCount || 0,

    reviewedOverflowCount:
      reviewedOverflowResult.rowCount || 0,

    unreviewedOverflowCount:
      unreviewedOverflowResult.rowCount || 0,
  };
}

async function cleanupReports(
  reviewDeadlineDays = 3,
  retentionDays = 7,
  maxPerArchive = 100
) {
  const movedCount =
    await moveExpiredPendingToUnreviewed(
      reviewDeadlineDays
    );

  const cleanupResult =
    await cleanupArchivedReports(
      retentionDays,
      maxPerArchive
    );

  return {
    movedToUnreviewed:
      movedCount,

    ...cleanupResult,
  };
}

module.exports = {
  REPORT_REASONS,

  createReport,

  listPendingReports,
  listReportsByStatus,
  listReviewedArchive,

  countPendingReports,
  countByStatus,
  countReviewedArchive,
  countPendingReportsByReason,

  getReportById,

  resolveReport,
  markReviewed,
  restoreToPending,
  deleteById,

  moveExpiredPendingToUnreviewed,
  cleanupArchivedReports,
  cleanupReports,
};
