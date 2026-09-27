const gameSettingsRepository = require("../repositories/game-settings.repository");

function parseValue(value, valueType, defaultValue = null) {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  switch (valueType) {
    case "boolean":
      if (typeof value === "boolean") {
        return value;
      }

      return String(value).toLowerCase() === "true";

    case "number": {
      const number = Number(value);

      return Number.isFinite(number)
        ? number
        : defaultValue;
    }

    case "json":
      if (typeof value === "object") {
        return value;
      }

      try {
        return JSON.parse(value);
      } catch {
        return defaultValue;
      }

    case "string":
    default:
      return String(value);
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

  return parseValue(
    setting.setting_value,
    setting.value_type,
    defaultValue
  );
}

async function getSettings(gameTypeId) {
  const settings =
    await gameSettingsRepository.getByGameType(gameTypeId);

  return settings.reduce((result, setting) => {
    result[setting.setting_key] = parseValue(
      setting.setting_value,
      setting.value_type,
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
    parsed_value: parseValue(
      setting.setting_value,
      setting.value_type,
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

  let valueToStore;

  if (setting.value_type === "json") {
    valueToStore = JSON.stringify(value);
  } else {
    valueToStore = String(value);
  }

  return gameSettingsRepository.setByGameTypeAndKey(
    gameTypeId,
    settingKey,
    valueToStore
  );
}

async function isGameEnabled(gameTypeId) {
  return getSetting(
    gameTypeId,
    "enabled",
    false
  );
}

async function getGameCost(gameTypeId) {
  return getSetting(
    gameTypeId,
    "cost",
    1
  );
}

async function getQuestionCount(gameTypeId) {
  return getSetting(
    gameTypeId,
    "question_count",
    10
  );
}

module.exports = {
  getSetting,
  getSettings,
  getAllSettings,
  setSetting,
  isGameEnabled,
  getGameCost,
  getQuestionCount,
};
