const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO user_activity_daily (
        user_id,
        activity_date,
        downloads_count,
        requests_count,
        successful_downloads,
        failed_downloads
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      data.userId,
      data.activityDate,
      data.downloadsCount ?? 0,
      data.requestsCount ?? 0,
      data.successfulDownloads ?? 0,
      data.failedDownloads ?? 0,
    ]
  );

  return result.rows[0];
}

async function findByUserAndDate(userId, activityDate) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM user_activity_daily
      WHERE user_id = $1
        AND activity_date = $2
      LIMIT 1
    `,
    [userId, activityDate]
  );

  return result.rows[0] || null;
}

async function findByUser(userId, limit = 30) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 30, 365)
  );

  const result = await db.query(
    `
      SELECT *
      FROM user_activity_daily
      WHERE user_id = $1
      ORDER BY activity_date DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function updateByUserAndDate(userId, activityDate, updates) {
  const db = getClient();

  const allowedFields = [
    "downloads_count",
    "requests_count",
    "successful_downloads",
    "failed_downloads",
  ];

  const entries = Object.entries(updates).filter(([field]) =>
    allowedFields.includes(field)
  );

  if (entries.length === 0) {
    return findByUserAndDate(userId, activityDate);
  }

  const values = entries.map(([, value]) => value);

  const setClause = entries
    .map(([field], index) => `${field} = $${index + 3}`)
    .join(", ");

  const result = await db.query(
    `
      UPDATE user_activity_daily
      SET ${setClause}
      WHERE user_id = $1
        AND activity_date = $2
      RETURNING *
    `,
    [userId, activityDate, ...values]
  );

  return result.rows[0] || null;
}

async function increment(userId, activityDate, field, amount = 1) {
  const db = getClient();

  const allowedFields = [
    "downloads_count",
    "requests_count",
    "successful_downloads",
    "failed_downloads",
  ];

  if (!allowedFields.includes(field)) {
    throw new Error(`Invalid analytics field: ${field}`);
  }

  const result = await db.query(
    `
      UPDATE user_activity_daily
      SET ${field} = COALESCE(${field}, 0) + $3
      WHERE user_id = $1
        AND activity_date = $2
      RETURNING *
    `,
    [userId, activityDate, amount]
  );

  return result.rows[0] || null;
}

module.exports = {
  create,
  findByUserAndDate,
  findByUser,
  updateByUserAndDate,
  increment,
};
