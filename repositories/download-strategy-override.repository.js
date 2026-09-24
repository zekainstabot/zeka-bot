const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_overrides (
        strategy_id,
        platform_id,
        override_type,
        override_value,
        is_active,
        reason,
        expires_at,
        created_by,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      data.strategyId,
      data.platformId,
      data.overrideType,
      data.overrideValue ?? null,
      data.isActive !== false,
      data.reason || null,
      data.expiresAt || null,
      data.createdBy || null,
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
      FROM download_strategy_overrides
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findActiveByStrategyId(strategyId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_overrides
      WHERE strategy_id = $1
        AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY id DESC
    `,
    [strategyId]
  );

  return result.rows;
}

async function findActiveByPlatformId(platformId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_overrides
      WHERE platform_id = $1
        AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY id DESC
    `,
    [platformId]
  );

  return result.rows;
}

async function findByOverrideType(platformId, overrideType) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_overrides
      WHERE platform_id = $1
        AND override_type = $2
        AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY id DESC
    `,
    [platformId, overrideType]
  );

  return result.rows;
}

async function update(id, updates) {
  const db = getClient();

  const allowedFields = [
    "override_type",
    "override_value",
    "is_active",
    "reason",
    "expires_at",
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
      UPDATE download_strategy_overrides
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
  findActiveByStrategyId,
  findActiveByPlatformId,
  findByOverrideType,
  update,
  activate,
  deactivate,
};
