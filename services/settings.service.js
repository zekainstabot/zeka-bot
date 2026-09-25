const settingsRepository = require("../repositories/settings.repository");

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  return String(value).toLowerCase() === "true";
}

async function getSetting(key, defaultValue = null) {
  const setting = await settingsRepository.getByKey(key);

  if (!setting) {
    return defaultValue;
  }

  switch (setting.value_type) {
    case "boolean":
      return parseBoolean(setting.setting_value);

    case "number":
      return Number(setting.setting_value);

    case "json":
      try {
        return JSON.parse(setting.setting_value);
      } catch {
        return defaultValue;
      }

    default:
      return setting.setting_value;
  }
}

async function setSetting(key, value) {
  const setting = await settingsRepository.setByKey(key, value);

  if (!setting) {
    throw new Error(`Setting not found: ${key}`);
  }

  return setting;
}

async function isPlatformEnabled(platform) {
  return getSetting(`platform.${platform}`, false);
}

async function isFeatureEnabled(feature) {
  return getSetting(`feature.${feature}`, false);
}

async function getAllSettings() {
  return settingsRepository.getAll();
}

async function getSettingsByCategory(category) {
  return settingsRepository.getByCategory(category);
}

module.exports = {
  getSetting,
  setSetting,
  isPlatformEnabled,
  isFeatureEnabled,
  getAllSettings,
  getSettingsByCategory,
};
