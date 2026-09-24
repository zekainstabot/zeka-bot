const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO leaderboard_entries (
        user_id,
        leaderboard_type,
        score,
        rank,
        period_start,
        period_end,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      data.userId,
      data.leaderboardType,
      data.score ?? 0,
      data.rank ?? null,
      data.periodStart || null,
      data.periodEnd || null,
      data.metadata || null,
    ]
  );

  return result.rows[0];
}

async function findById(id) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM leaderboard_entries
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByUserId(userId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM leaderboard_entries
      WHERE user_id = $1
      ORDER BY score DESC, created_at ASC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function findByType(leaderboardType, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM leaderboard_entries
      WHERE leaderboard_type = $1
      ORDER BY score DESC, created_at ASC
      LIMIT $2
    `,
    [leaderboardType, safeLimit]
  );

  return result.rows;
}

async function findByTypeAndPeriod(
  leaderboardType,
  periodStart,
  periodEnd,
  limit = 100
) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM leaderboard_entries
      WHERE leaderboard_type = $1
        AND period_start IS NOT DISTINCT FROM $2
        AND period_end IS NOT DISTINCT FROM $3
      ORDER BY score DESC, created_at ASC
      LIMIT $4
    `,
    [
      leaderboardType,
      periodStart || null,
      periodEnd || null,
      safeLimit,
    ]
  );

  return result.rows;
}

async function findUserEntry(
  userId,
  leaderboardType,
  periodStart = null,
  periodEnd = null
) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM leaderboard_entries
      WHERE user_id = $1
        AND leaderboard_type = $2
        AND period_start IS NOT DISTINCT FROM $3
        AND period_end IS NOT DISTINCT FROM $4
      LIMIT 1
    `,
    [
      userId,
      leaderboardType,
      periodStart,
      periodEnd,
    ]
  );

  return result.rows[0] || null;
}

async function findTop(
  leaderboardType,
  periodStart = null,
  periodEnd = null,
  limit = 10
) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 10, 100)
  );

  const result = await db.query(
    `
      SELECT *
      FROM leaderboard_entries
      WHERE leaderboard_type = $1
        AND period_start IS NOT DISTINCT FROM $2
        AND period_end IS NOT DISTINCT FROM $3
      ORDER BY score DESC, created_at ASC
      LIMIT $4
    `,
    [
      leaderboardType,
      periodStart,
      periodEnd,
      safeLimit,
    ]
  );

  return result.rows;
}

async function updateById(id, updates) {
  const db = getClient();

  const allowedFields = [
    "user_id",
    "leaderboard_type",
    "score",
    "rank",
    "period_start",
    "period_end",
    "metadata",
  ];

  const entries = Object.entries(updates).filter(([field]) =>
    allowedFields.includes(field)
  );

  if (entries.length === 0) {
    return findById(id);
  }

  const values = entries.map(([, value]) => value);

  const setClause = entries
    .map(([field], index) => `${field} = $${index + 2}`)
    .join(", ");

  const result = await db.query(
    `
      UPDATE leaderboard_entries
      SET
        ${setClause},
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

async function updateScore(id, score) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE leaderboard_entries
      SET
        score = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, score]
  );

  return result.rows[0] || null;
}

async function updateRank(id, rank) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE leaderboard_entries
      SET
        rank = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, rank]
  );

  return result.rows[0] || null;
}

async function deleteById(id) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM leaderboard_entries
      WHERE id = $1
    `,
    [id]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findByUserId,
  findByType,
  findByTypeAndPeriod,
  findUserEntry,
  findTop,
  updateById,
  updateScore,
  updateRank,
  deleteById,
};
