const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO provider_failover (
        platform_id,
        primary_provider,
        fallback_provider,
        status,
        reason,
        switched_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      data.platformId,
      data.primaryProvider,
      data.fallbackProvider,
      data.status || "ACTIVE",
      data.reason || null,
      data.switchedAt || null,
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
      FROM provider_failover
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
      FROM provider_failover
      WHERE platform_id = $1
        AND status = 'ACTIVE'
      ORDER BY id DESC
      LIMIT 1
    `,
    [platformId]
  );

  return result.rows[0] || null;
}

async function findHistory(platformId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM provider_failover
      WHERE platform_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [platformId, safeLimit]
  );

  return result.rows;
}

async function update(id, updates) {
  const db = getClient();

  const allowedFields = [
    "primary_provider",
    "fallback_provider",
    "status",
    "reason",
    "switched_at",
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
      UPDATE provider_failover
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
    status: "ACTIVE",
  });
}

async function deactivate(id) {
  return update(id, {
    status: "INACTIVE",
  });
}

module.exports = {
  create,
  findById,
  findActiveByPlatformId,
  findHistory,
  update,
  activate,
  deactivate,
};
