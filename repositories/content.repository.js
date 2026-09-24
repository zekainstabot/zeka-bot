const { getClient } = require("../database/client");

async function findById(id) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM contents
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByContentId(contentId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM contents
      WHERE content_id = $1
      LIMIT 1
    `,
    [contentId]
  );

  return result.rows[0] || null;
}

async function findByPlatform(platform) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM contents
      WHERE platform = $1
      ORDER BY created_at DESC
    `,
    [platform]
  );

  return result.rows;
}

async function create(content) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO contents (
        content_id,
        platform,
        content_type,
        title,
        description,
        author_username,
        original_url,
        normalized_url,
        thumbnail_url,
        metadata
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10
      )
      RETURNING *
    `,
    [
      content.contentId,
      content.platform,
      content.contentType || null,
      content.title || null,
      content.description || null,
      content.authorUsername || null,
      content.originalUrl || null,
      content.normalizedUrl || null,
      content.thumbnailUrl || null,
      content.metadata || {},
    ]
  );

  return result.rows[0];
}

async function updateById(id, updates) {
  const db = getClient();

  const allowedFields = [
    "content_type",
    "title",
    "description",
    "author_username",
    "original_url",
    "normalized_url",
    "thumbnail_url",
    "metadata",
  ];

  const entries = Object.entries(updates).filter(
    ([field]) => allowedFields.includes(field)
  );

  if (entries.length === 0) {
    return findById(id);
  }

  const values = entries.map(([, value]) => value);

  const setClause = entries
    .map(
      ([field], index) =>
        `${field} = $${index + 2}`
    )
    .join(", ");

  const result = await db.query(
    `
      UPDATE contents
      SET ${setClause},
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

async function deleteById(id) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM contents
      WHERE id = $1
      RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}

module.exports = {
  findById,
  findByContentId,
  findByPlatform,
  create,
  updateById,
  deleteById,
};
