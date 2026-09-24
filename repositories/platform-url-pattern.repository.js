const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO platform_url_patterns (
        platform_id,
        pattern,
        pattern_type,
        is_active,
        priority,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      data.platformId,
      data.pattern,
      data.patternType || "REGEX",
      data.isActive !== false,
      data.priority ?? 0,
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
      FROM platform_url_patterns
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findActiveByPlatformId(platformId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM platform_url_patterns
      WHERE platform_id = $1
        AND is_active = TRUE
      ORDER BY priority DESC, id ASC
    `,
    [platformId]
  );

  return result.rows;
}

async function findByPatternType(platformId, patternType) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM platform_url_patterns
      WHERE platform_id = $1
        AND pattern_type = $2
        AND is_active = TRUE
      ORDER BY priority DESC, id ASC
    `,
    [platformId, patternType]
  );

  return result.rows;
}

async function update(id, updates) {
  const db = getClient();

  const allowedFields = [
    "pattern",
    "pattern_type",
    "is_active",
    "priority",
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
      UPDATE platform_url_patterns
      SET ${setClause},
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

async function activate(id) {
  return update(id, {
    is_active: true,
  });
}

async function deactivate(id) {
  return update(id, {
    is_active: false,
  });
}

module.exports = {
  create,
  findById,
  findActiveByPlatformId,
  findByPatternType,
  update,
  activate,
  deactivate,
};
