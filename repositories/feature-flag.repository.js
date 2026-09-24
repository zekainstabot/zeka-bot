const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO feature_flags (
        flag_key,
        display_name,
        description,
        flag_type,
        enabled,
        status,
        config,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      data.flagKey,
      data.displayName || null,
      data.description || null,
      data.flagType || "FEATURE",
      data.enabled ?? false,
      data.status || "ACTIVE",
      data.config || null,
      data.updatedBy || null,
    ]
  );

  return result.rows[0];
}

async function findById(id) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM feature_flags
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByKey(flagKey) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM feature_flags
      WHERE flag_key = $1
      LIMIT 1
    `,
    [flagKey]
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
      FROM feature_flags
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function findActive(limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM feature_flags
      WHERE status = 'ACTIVE'
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function findEnabled(limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM feature_flags
      WHERE enabled = TRUE
        AND status = 'ACTIVE'
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function isEnabled(flagKey) {
  const flag = await findByKey(flagKey);

  return Boolean(
    flag &&
    flag.enabled === true &&
    flag.status === "ACTIVE"
  );
}

async function updateById(id, updates) {
  const db = getClient();

  const allowedFields = [
    "flag_key",
    "display_name",
    "description",
    "flag_type",
    "enabled",
    "status",
    "config",
    "updated_by",
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
      UPDATE feature_flags
      SET
        ${setClause},
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

async function setEnabled(id, enabled, updatedBy = null) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE feature_flags
      SET
        enabled = $2,
        updated_by = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, Boolean(enabled), updatedBy]
  );

  return result.rows[0] || null;
}

async function setStatus(id, status, updatedBy = null) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE feature_flags
      SET
        status = $2,
        updated_by = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, status, updatedBy]
  );

  return result.rows[0] || null;
}

async function deleteById(id) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM feature_flags
      WHERE id = $1
    `,
    [id]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findByKey,
  findAll,
  findActive,
  findEnabled,
  isEnabled,
  updateById,
  setEnabled,
  setStatus,
  deleteById,
};
