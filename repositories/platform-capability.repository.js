const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO platform_capabilities (
        platform_id,
        capability,
        is_supported,
        is_enabled,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [
      data.platformId,
      data.capability,
      data.isSupported !== false,
      data.isEnabled !== false,
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
      FROM platform_capabilities
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByPlatformId(platformId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM platform_capabilities
      WHERE platform_id = $1
      ORDER BY id ASC
    `,
    [platformId]
  );

  return result.rows;
}

async function findEnabledByPlatformId(platformId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM platform_capabilities
      WHERE platform_id = $1
        AND is_supported = TRUE
        AND is_enabled = TRUE
      ORDER BY id ASC
    `,
    [platformId]
  );

  return result.rows;
}

async function findByCapability(platformId, capability) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM platform_capabilities
      WHERE platform_id = $1
        AND capability = $2
      LIMIT 1
    `,
    [platformId, capability]
  );

  return result.rows[0] || null;
}

async function update(id, updates) {
  const db = getClient();

  const allowedFields = [
    "capability",
    "is_supported",
    "is_enabled",
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
      UPDATE platform_capabilities
      SET ${setClause},
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

async function enable(id) {
  return update(id, {
    is_enabled: true,
  });
}

async function disable(id) {
  return update(id, {
    is_enabled: false,
  });
}

module.exports = {
  create,
  findById,
  findByPlatformId,
  findEnabledByPlatformId,
  findByCapability,
  update,
  enable,
  disable,
};
