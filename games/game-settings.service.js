const gameSettingsRepository = require("../repositories/game-settings.repository");

function parseSettingValue(value, defaultValue = null) {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function getSetting(
  gameTypeId,
  settingKey,
  defaultValue = null
) {
  const setting =
    await gameSettingsRepository.getByGameTypeAndKey(
      gameTypeId,
      settingKey
    );

  if (!setting) {
    return defaultValue;
  }

  return parseSettingValue(
    setting.setting_value,
    defaultValue
  );
}

async function getSettings(gameTypeId) {
  const settings =
    await gameSettingsRepository.getByGameType(gameTypeId);

  return settings.reduce((result, setting) => {
    result[setting.setting_key] = parseSettingValue(
      setting.setting_value,
      null
    );

    return result;
  }, {});
}

async function getAllSettings() {
  const settings =
    await gameSettingsRepository.getAll();

  return settings.map((setting) => ({
    ...setting,
    parsed_value: parseSettingValue(
      setting.setting_value,
      null
    ),
  }));
}

async function setSetting(
  gameTypeId,
  settingKey,
  value
) {
  const setting =
    await gameSettingsRepository.getByGameTypeAndKey(
      gameTypeId,
      settingKey
    );

  if (!setting) {
    throw new Error(
      `Game setting not found: ${gameTypeId}:${settingKey}`
    );
  }

  return gameSettingsRepository.setByGameTypeAndKey(
    gameTypeId,
    settingKey,
    value
  );
}

async function getGameTypeByKey(gameKey) {
  if (!gameKey) {
    throw new Error("Game key is required");
  }

  return gameSettingsRepository.getGameTypeByKey(
    gameKey
  );
}

async function isGameEnabled(gameTypeId) {
  const value = await getSetting(
    gameTypeId,
    "enabled",
    false
  );

  if (typeof value === "boolean") {
    return value;
  }

  return Boolean(value);
}

async function getGameCost(gameTypeId) {
  const value = await getSetting(
    gameTypeId,
    "cost",
    { credit: 1 }
  );

  if (typeof value === "number") {
    return value;
  }

  if (value && typeof value === "object") {
    const cost = Number(value.credit);

    return Number.isFinite(cost) ? cost : 1;
  }

  const cost = Number(value);

  return Number.isFinite(cost) ? cost : 1;
}

async function getQuestionCount(gameTypeId) {
  const value = await getSetting(
    gameTypeId,
    "quiz_question_count",
    { count: 10 }
  );

  if (typeof value === "number") {
    return value;
  }

  if (value && typeof value === "object") {
    const count = Number(value.count);

    return Number.isInteger(count) && count > 0
      ? count
      : 10;
  }

  const count = Number(value);

  return Number.isInteger(count) && count > 0
    ? count
    : 10;
}

module.exports = {
  getSetting,
  getSettings,
  getAllSettings,
  setSetting,
  getGameTypeByKey,
  isGameEnabled,
  getGameCost,
  getQuestionCount,
};
