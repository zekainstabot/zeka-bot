const { initializeDatabase } = require("./database/bootstrap");
const { startBot } = require("./bot");

async function start() {
  console.log("Zeka Bot starting...");

  try {
    await initializeDatabase();

    console.log("Zeka Bot database initialized.");

    await startBot();
  } catch (error) {
    console.error("Failed to start Zeka Bot.");
    console.error(error);

    process.exitCode = 1;
  }
}

start();
