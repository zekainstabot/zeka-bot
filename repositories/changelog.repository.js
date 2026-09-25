const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO changelog (
        version,
        title,
        description,
        change_type,
        is_public,
        published_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      data.version,
      data.title,
      data.description || null,
      data.changeType || "UPDATE",
      data.isPublic ?? true,
      data.publishedAt || null,
    ]
  );

  return result.rows[0];
}

async function findById(id) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM changelog
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByVersion(version) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM changelog
      WHERE version = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [version]
  );

  return result.rows[0] || null;
}

async function findAll(limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM changelog
      ORDER BY
        published_at DESC NULLS LAST,
        created_at DESC,
        id DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function findPublic(limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM changelog
      WHERE is_public = TRUE
      ORDER BY
        published_at DESC NULLS LAST,
        created_at DESC,
        id DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function updateById(id, updates) {
  const db = getClient();

  const allowedFields = [
    "version",
    "title",
    "description",
    "change_type",
    "is_public",
    "published_at",
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
      UPDATE changelog
      SET ${setClause}
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
      DELETE FROM changelog
      WHERE id = $1
    `,
    [id]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findByVersion,
  findAll,
  findPublic,
  updateById,
  deleteById,
};
