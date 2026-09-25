const { getPool } = require("../database/pool");

async function getByKey(settingKey) {
  const db = getPool();

  const result = await db.query(
    `
      SELECT
        id,
        setting_key,
        setting_value,
        value_type,
        category,
        description,
        is_public,
        created_at,
        updated_at
      FROM system_settings
      WHERE setting_key = $1
      LIMIT 1
    `,
    [settingKey]
  );

  return result.rows[0] || null;
}

async function getAll() {
  const db = getPool();

  const result = await db.query(
    `
      SELECT
        id,
        setting_key,
        setting_value,
        value_type,
        category,
        description,
        is_public,
        created_at,
        updated_at
      FROM system_settings
      ORDER BY category ASC, setting_key ASC
    `
  );

  return result.rows;
}

async function getByCategory(category) {
  const db = getPool();

  const result = await db.query(
    `
      SELECT
        id,
        setting_key,
        setting_value,
        value_type,
        category,
        description,
        is_public,
        created_at,
        updated_at
      FROM system_settings
      WHERE category = $1
      ORDER BY setting_key ASC
    `,
    [category]
  );

  return result.rows;
}

async function setByKey(settingKey, settingValue) {
  const db = getPool();

  const result = await db.query(
    `
      UPDATE system_settings
      SET
        setting_value = $2,
        updated_at = NOW()
      WHERE setting_key = $1
      RETURNING
        id,
        setting_key,
        setting_value,
        value_type,
        category,
        description,
        is_public,
        created_at,
        updated_at
    `,
    [settingKey, String(settingValue)]
  );

  return result.rows[0] || null;
}

module.exports = {
  getByKey,
  getAll,
  getByCategory,
  setByKey,
};
