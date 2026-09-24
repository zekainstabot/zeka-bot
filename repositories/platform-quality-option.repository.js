const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO platform_quality_options (
        platform_id,
        quality,
        format,
        is_supported,
        is_enabled,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      data.platformId,
      data.quality,
      data.format || null,
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
      FROM platform_quality_options
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
      FROM platform_quality_options
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
      FROM platform_quality_options
      WHERE platform_id = $1
        AND is_supported = TRUE
        AND is_enabled = TRUE
      ORDER BY id ASC
    `,
    [platformId]
  );

  return result.rows;
}

async function findByQuality(platformId, quality, format = null) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM platform_quality_options
      WHERE platform_id = $1
        AND quality = $2
        AND ($3::VARCHAR IS NULL OR format = $3)
      LIMIT 1
    `,
    [platformId, quality, format]
  );

  return result.rows[0] || null;
}

async function update(id, updates) {
  const db = getClient();

  const allowedFields = [
    "quality",
    "format",
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
      UPDATE platform_quality_options
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
  findByQuality,
  update,
  enable,
  disable,
};
