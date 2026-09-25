const http = require("http");

const { initializeDatabase } = require("./database/bootstrap");
const { startBot } = require("./bot");

const PORT = Number(process.env.PORT) || 10000;

function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
      });

      res.end("Zeka Bot is running");
      return;
    }

    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
    });

    res.end("Not Found");
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`HTTP server running on port ${PORT}`);
  });

  return server;
}

async function start() {
  console.log("Zeka Bot starting...");

  try {
    startHealthServer();

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
