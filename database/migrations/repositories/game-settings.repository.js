const { getPool } = require("../database/pool");

async function getByGameTypeAndKey(gameTypeId, settingKey) {
  const db = getPool();

  const result = await db.query(
    `
      SELECT
        id,
        game_type_id,
        setting_key,
        setting_value,
        value_type,
        description,
        created_at,
        updated_at
      FROM game_settings
      WHERE game_type_id = $1
        AND setting_key = $2
      LIMIT 1
    `,
    [gameTypeId, settingKey]
  );

  return result.rows[0] || null;
}

async function getByGameType(gameTypeId) {
  const db = getPool();

  const result = await db.query(
    `
      SELECT
        id,
        game_type_id,
        setting_key,
        setting_value,
        value_type,
        description,
        created_at,
        updated_at
      FROM game_settings
      WHERE game_type_id = $1
      ORDER BY setting_key ASC
    `,
    [gameTypeId]
  );

  return result.rows;
}

async function getAll() {
  const db = getPool();

  const result = await db.query(
    `
      SELECT
        gs.id,
        gs.game_type_id,
        gt.game_key,
        gt.name_key,
        gs.setting_key,
        gs.setting_value,
        gs.value_type,
        gs.description,
        gs.created_at,
        gs.updated_at
      FROM game_settings gs
      JOIN game_types gt
        ON gt.id = gs.game_type_id
      ORDER BY gt.game_key ASC, gs.setting_key ASC
    `
  );

  return result.rows;
}

async function setByGameTypeAndKey(
  gameTypeId,
  settingKey,
  settingValue
) {
  const db = getPool();

  const result = await db.query(
    `
      UPDATE game_settings
      SET
        setting_value = $3,
        updated_at = NOW()
      WHERE game_type_id = $1
        AND setting_key = $2
      RETURNING
        id,
        game_type_id,
        setting_key,
        setting_value,
        value_type,
        description,
        created_at,
        updated_at
    `,
    [
      gameTypeId,
      settingKey,
      String(settingValue),
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  getByGameTypeAndKey,
  getByGameType,
  getAll,
  setByGameTypeAndKey,
};
