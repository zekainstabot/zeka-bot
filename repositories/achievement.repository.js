const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO achievements (
        code,
        name,
        description,
        xp_reward,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [
      data.code,
      data.name,
      data.description || null,
      data.xpReward ?? 0,
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
      FROM achievements
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByCode(code) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM achievements
      WHERE code = $1
      LIMIT 1
    `,
    [code]
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
      FROM achievements
      ORDER BY id ASC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function updateById(id, updates) {
  const db = getClient();

  const allowedFields = [
    "code",
    "name",
    "description",
    "xp_reward",
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
      UPDATE achievements
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
      DELETE FROM achievements
      WHERE id = $1
    `,
    [id]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findByCode,
  findAll,
  updateById,
  deleteById,
};
