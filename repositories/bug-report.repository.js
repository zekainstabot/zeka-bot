const {
  getClient,
} = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO bug_reports (
        user_id,
        telegram_user_id,
        username,
        display_name,
        report,
        original_url,
        job_id,
        status
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8
      )
      RETURNING *
    `,
    [
      data.userId || null,
      data.telegramUserId,
      data.username || null,
      data.displayName || null,
      data.report,
      data.originalUrl || null,
      data.jobId || null,
      data.status || "PENDING",
    ]
  );

  return result.rows[0];
}

async function findById(id) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM bug_reports
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findPending(limit = 50) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(
      Number(limit) || 50,
      200
    )
  );

  const result = await db.query(
    `
      SELECT *
      FROM bug_reports
      WHERE status = 'PENDING'
        AND created_at >=
          NOW() - INTERVAL '3 days'
      ORDER BY created_at ASC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function findByStatus(status, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(
      Number(limit) || 100,
      500
    )
  );

  const result = await db.query(
    `
      SELECT *
      FROM bug_reports
      WHERE status = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
    `,
    [
      status,
      safeLimit,
    ]
  );

  return result.rows;
}

async function findAll(limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(
      Number(limit) || 100,
      500
    )
  );

  const result = await db.query(
    `
      SELECT *
      FROM bug_reports
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function countPending() {
  const db = getClient();

  const result = await db.query(
    `
      SELECT COUNT(*)::int AS count
      FROM bug_reports
      WHERE status = 'PENDING'
    `
  );

  return result.rows[0]?.count || 0;
}

async function countByStatus(status) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT COUNT(*)::int AS count
      FROM bug_reports
      WHERE status = $1
    `,
    [status]
  );

  return result.rows[0]?.count || 0;
}

async function markReviewed(
  id,
  reviewedBy
) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE bug_reports
      SET
        status = 'REVIEWED',
        reviewed_by = $2,
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      reviewedBy,
    ]
  );

  return result.rows[0] || null;
}

async function markPending(id) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE bug_reports
      SET
        status = 'PENDING',
        reviewed_by = NULL,
        reviewed_at = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function markUnreviewed(id) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE bug_reports
      SET
        status = 'UNREVIEWED',
        reviewed_by = NULL,
        reviewed_at = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function deleteById(id) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM bug_reports
      WHERE id = $1
    `,
    [id]
  );

  return result.rowCount;
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
      UPDATE bug_reports
      SET
        status = 'UNREVIEWED',
        updated_at = NOW()
      WHERE status = 'PENDING'
        AND created_at <
          NOW() - ($1::int * INTERVAL '1 day')
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
      DELETE FROM bug_reports
      WHERE created_at <
        NOW() - ($1::int * INTERVAL '1 day')
        AND status IN (
          'REVIEWED',
          'UNREVIEWED'
        )
    `,
    [safeRetentionDays]
  );

  const reviewedOverflowResult = await db.query(
    `
      DELETE FROM bug_reports
      WHERE id IN (
        SELECT id
        FROM bug_reports
        WHERE status = 'REVIEWED'
        ORDER BY created_at DESC, id DESC
        OFFSET $1
      )
    `,
    [safeMaxPerArchive]
  );

  const unreviewedOverflowResult = await db.query(
    `
      DELETE FROM bug_reports
      WHERE id IN (
        SELECT id
        FROM bug_reports
        WHERE status = 'UNREVIEWED'
        ORDER BY created_at DESC, id DESC
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
    movedToUnreviewed: movedCount,
    ...cleanupResult,
  };
}

module.exports = {
  create,
  findById,
  findPending,
  findByStatus,
  findAll,
  countPending,
  countByStatus,
  markReviewed,
  markPending,
  markUnreviewed,
  deleteById,
  moveExpiredPendingToUnreviewed,
  cleanupArchivedReports,
  cleanupReports,
};
