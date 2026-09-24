const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO platform_url_rules (
        platform_id,
        rule_type,
        pattern,
        is_active,
        priority,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      data.platformId,
      data.ruleType,
      data.pattern,
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
      FROM platform_url_rules
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
      FROM platform_url_rules
      WHERE platform_id = $1
        AND is_active = TRUE
      ORDER BY priority DESC, id ASC
    `,
    [platformId]
  );

  return result.rows;
}

async function findByRuleType(platformId, ruleType) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM platform_url_rules
      WHERE platform_id = $1
        AND rule_type = $2
        AND is_active = TRUE
      ORDER BY priority DESC, id ASC
    `,
    [platformId, ruleType]
  );

  return result.rows;
}

async function update(id, updates) {
  const db = getClient();

  const allowedFields = [
    "rule_type",
    "pattern",
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
      UPDATE platform_url_rules
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
  findByRuleType,
  update,
  activate,
  deactivate,
};
