const environment = process.env.NODE_ENV || "development";

function parseTelegramIds(value) {
  if (!value) return [];

  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => Number(id))
    .filter((id) => Number.isSafeInteger(id));
}

const config = {
  environment,

  isDevelopment: environment === "development",
  isProduction: environment === "production",
  isTest: environment === "test",

  bot: {
    token: process.env.BOT_TOKEN || "",
  },

  admin: {
    telegramIds: parseTelegramIds(
      process.env.ADMIN_TELEGRAM_IDS || ""
    ),
  },

  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
};

module.exports = config;
