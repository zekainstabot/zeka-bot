const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO collection_items (
        collection_id,
        content_id,
        position,
        metadata
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [
      data.collectionId,
      data.contentId,
      data.position ?? 0,
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
      FROM collection_items
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByCollectionId(collectionId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM collection_items
      WHERE collection_id = $1
      ORDER BY position ASC, id ASC
      LIMIT $2
    `,
    [collectionId, safeLimit]
  );

  return result.rows;
}

async function findByCollectionAndContent(collectionId, contentId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM collection_items
      WHERE collection_id = $1
        AND content_id = $2
      LIMIT 1
    `,
    [collectionId, contentId]
  );

  return result.rows[0] || null;
}

async function updateById(id, updates) {
  const db = getClient();

  const allowedFields = [
    "position",
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
      UPDATE collection_items
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
      DELETE FROM collection_items
      WHERE id = $1
      `,
    [id]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findByCollectionId,
  findByCollectionAndContent,
  updateById,
  deleteById,
};
