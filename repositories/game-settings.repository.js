const { getClient } = require("../database/client");

function getDb(client = null) {
  return client || getClient();
}

async function getByGameTypeAndKey(gameTypeId, settingKey, client = null) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT
        id,
        game_type_id,
        setting_key,
        setting_value,
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

async function getByGameType(gameTypeId, client = null) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT
        id,
        game_type_id,
        setting_key,
        setting_value,
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

async function getAll(client = null) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT
        gs.id,
        gs.game_type_id,
        gt.game_key,
        gt.title_key,
        gs.setting_key,
        gs.setting_value,
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
  settingValue,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
    `
      UPDATE game_settings
      SET
        setting_value = $3::JSONB,
        updated_at = NOW()
      WHERE game_type_id = $1
        AND setting_key = $2
      RETURNING
        id,
        game_type_id,
        setting_key,
        setting_value,
        description,
        created_at,
        updated_at
    `,
    [
      gameTypeId,
      settingKey,
      JSON.stringify(settingValue),
    ]
  );

  return result.rows[0] || null;
}

async function getGameTypeByKey(gameKey, client = null) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT
        id,
        game_key,
        title_key,
        description_key,
        game_type,
        entry_cost,
        status,
        config,
        created_at,
        updated_at
      FROM game_types
      WHERE game_key = $1
      LIMIT 1
    `,
    [gameKey]
  );

  return result.rows[0] || null;
}

module.exports = {
  getByGameTypeAndKey,
  getByGameType,
  getAll,
  setByGameTypeAndKey,
  getGameTypeByKey,
};
