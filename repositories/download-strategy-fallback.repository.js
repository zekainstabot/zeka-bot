const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_fallbacks (
        strategy_id,
        fallback_strategy_id,
        priority,
        is_active,
        reason,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      data.strategyId,
      data.fallbackStrategyId,
      data.priority ?? 0,
      data.isActive !== false,
      data.reason || null,
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
      FROM download_strategy_fallbacks
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByStrategyId(strategyId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_fallbacks
      WHERE strategy_id = $1
        AND is_active = TRUE
      ORDER BY priority ASC, id ASC
    `,
    [strategyId]
  );

  return result.rows;
}

async function findActiveFallback(strategyId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_fallbacks
      WHERE strategy_id = $1
        AND is_active = TRUE
      ORDER BY priority ASC, id ASC
      LIMIT 1
    `,
    [strategyId]
  );

  return result.rows[0] || null;
}

async function update(id, updates) {
  const db = getClient();

  const allowedFields = [
    "fallback_strategy_id",
    "priority",
    "is_active",
    "reason",
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
      UPDATE download_strategy_fallbacks
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
  findByStrategyId,
  findActiveFallback,
  update,
  activate,
  deactivate,
};
