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
      ORDER BY created_at ASC
      LIMIT $1
    `,
    [safeLimit]
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

async function cleanupExpiredAndOverflow(
  limit = 100,
  maxAgeDays = 7
) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(
      Number(limit) || 100,
      1000
    )
  );

  const safeAgeDays = Math.max(
    1,
    Math.min(
      Number(maxAgeDays) || 7,
      365
    )
  );

  const result = await db.query(
    `
      WITH expired AS (
        DELETE FROM bug_reports
        WHERE created_at <
          NOW() - ($1::int * INTERVAL '1 day')
        RETURNING id
      ),
      ranked AS (
        SELECT id
        FROM bug_reports
        ORDER BY created_at DESC, id DESC
        OFFSET $2
      ),
      overflow AS (
        DELETE FROM bug_reports
        WHERE id IN (
          SELECT id
          FROM ranked
        )
        RETURNING id
      )
      SELECT
        (
          SELECT COUNT(*)
          FROM expired
        )::int AS expired_count,
        (
          SELECT COUNT(*)
          FROM overflow
        )::int AS overflow_count
    `,
    [
      safeAgeDays,
      safeLimit,
    ]
  );

  return {
    expiredCount:
      result.rows[0]?.expired_count || 0,
    overflowCount:
      result.rows[0]?.overflow_count || 0,
  };
}

module.exports = {
  create,
  findById,
  findPending,
  findAll,
  countPending,
  markReviewed,
  markPending,
  deleteById,
  cleanupExpiredAndOverflow,
};
