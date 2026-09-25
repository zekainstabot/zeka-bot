const {
  isFeatureEnabled,
  setSetting,
  getSettingsByCategory,
} = require("./settings.service");

async function isEnabled(feature) {
  return isFeatureEnabled(feature);
}

async function enable(feature) {
  return setSetting(`feature.${feature}`, true);
}

async function disable(feature) {
  return setSetting(`feature.${feature}`, false);
}

async function getAll() {
  return getSettingsByCategory("feature");
}

module.exports = {
  isEnabled,
  enable,
  disable,
  getAll,
};
