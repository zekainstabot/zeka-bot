const { initializeDatabase } = require("./database/bootstrap");

async function start() {
  console.log("Zeka Bot starting...");

  try {
    await initializeDatabase();

    console.log("Zeka Bot database initialized.");
  } catch (error) {
    console.error("Failed to initialize database.");
    console.error(error);

    process.exitCode = 1;
  }
}

start();
