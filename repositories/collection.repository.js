const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO collections (
        user_id,
        name,
        description,
        metadata
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [
      data.userId,
      data.name,
      data.description || null,
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
      FROM collections
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
      FROM collections
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function findByUserAndName(userId, name) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM collections
      WHERE user_id = $1
        AND name = $2
      LIMIT 1
    `,
    [userId, name]
  );

  return result.rows[0] || null;
}

async function updateById(id, updates) {
  const db = getClient();

  const allowedFields = [
    "name",
    "description",
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
      UPDATE collections
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
      DELETE FROM collections
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
  findByUserAndName,
  updateById,
  deleteById,
};
