const environment = process.env.NODE_ENV || "development";

const config = {
  environment,

  isDevelopment: environment === "development",
  isProduction: environment === "production",
  isTest: environment === "test",

  bot: {
    token: process.env.BOT_TOKEN || "",
  },

  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
};

module.exports = config;
