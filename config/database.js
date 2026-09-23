const databaseConfig = {
  url: process.env.DATABASE_URL || "",

  pool: {
    min: 1,
    max: 10,
  },

  ssl: process.env.NODE_ENV === "production",
};

module.exports = databaseConfig;
