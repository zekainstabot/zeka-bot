const { getClient } = require("../database/client");

async function findById(id) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM platforms
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findBySlug(slug) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM platforms
      WHERE slug = $1
      LIMIT 1
    `,
    [slug]
  );

  return result.rows[0] || null;
}

async function findActive() {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM platforms
      WHERE status = 'ACTIVE'
      ORDER BY id ASC
    `
  );

  return result.rows;
}

async function findAll() {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM platforms
      ORDER BY id ASC
    `
  );

  return result.rows;
}

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO platforms (
        slug,
        name,
        status,
        metadata
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [
      data.slug,
      data.name,
      data.status || "DEVELOPMENT",
      data.metadata || null,
    ]
  );

  return result.rows[0];
}

async function update(id, updates) {
  const db = getClient();

  const allowedFields = [
    "slug",
    "name",
    "status",
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
      UPDATE platforms
      SET ${setClause},
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

async function setStatus(id, status) {
  return update(id, { status });
}

module.exports = {
  findById,
  findBySlug,
  findActive,
  findAll,
  create,
  update,
  setStatus,
};
