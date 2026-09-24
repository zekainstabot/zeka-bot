const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO favorites (
        user_id,
        platform,
        content_type,
        content_id,
        original_url,
        normalized_url,
        title,
        thumbnail_url,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      data.userId,
      data.platform,
      data.contentType || null,
      data.contentId || null,
      data.originalUrl,
      data.normalizedUrl || data.originalUrl,
      data.title || null,
      data.thumbnailUrl || null,
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
      FROM favorites
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
      FROM favorites
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function findByUserAndUrl(userId, normalizedUrl) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM favorites
      WHERE user_id = $1
        AND normalized_url = $2
      LIMIT 1
    `,
    [userId, normalizedUrl]
  );

  return result.rows[0] || null;
}

async function exists(userId, normalizedUrl) {
  const favorite = await findByUserAndUrl(userId, normalizedUrl);
  return Boolean(favorite);
}

async function removeById(id, userId = null) {
  const db = getClient();

  const params = userId === null
    ? [id]
    : [id, userId];

  const result = await db.query(
    userId === null
      ? `
          DELETE FROM favorites
          WHERE id = $1
        `
      : `
          DELETE FROM favorites
          WHERE id = $1
            AND user_id = $2
        `,
    params
  );

  return result.rowCount;
}

async function removeByUrl(userId, normalizedUrl) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM favorites
      WHERE user_id = $1
        AND normalized_url = $2
    `,
    [userId, normalizedUrl]
  );

  return result.rowCount;
}

async function updateById(id, updates) {
  const db = getClient();

  const allowedFields = [
    "platform",
    "content_type",
    "content_id",
    "original_url",
    "normalized_url",
    "title",
    "thumbnail_url",
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
      UPDATE favorites
      SET ${setClause},
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

module.exports = {
  create,
  findById,
  findByUserId,
  findByUserAndUrl,
  exists,
  removeById,
  removeByUrl,
  updateById,
};
