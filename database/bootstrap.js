const { checkConnection } = require("./client");
const { runMigrations } = require("./migrator");

async function initializeDatabase() {
  console.log("Checking database connection...");

  await checkConnection();

  console.log("Database connection OK.");

  const result = await runMigrations();

  console.log(
    `Database migrations complete. Applied: ${result.applied}, Total: ${result.total}`
  );

  return result;
}

module.exports = {
  initializeDatabase,
};
