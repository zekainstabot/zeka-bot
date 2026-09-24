const fs = require("fs");
const path = require("path");

const REQUIRED_FILES = [
  "app.js",
  "bot.js",
  "config/app.js",
  "config/database.js",
  "config/queue.js",
  "database/client.js",
  "database/pool.js",
  "database/migrator.js",
  "database/bootstrap.js",
  "services/user.service.js",
  "services/url.service.js",
  "services/request.service.js",
  "services/download.service.js",
  "services/file.service.js",
  "services/delivery.service.js",
  "services/instagram.service.js",
  "services/instagram.downloader.js",
  "queue/manager.js",
  "queue/service.js",
  "workers/job.worker.js",
];

function checkFile(filePath) {
  const absolutePath = path.join(
    process.cwd(),
    filePath
  );

  return fs.existsSync(absolutePath);
}

function runHealthCheck() {
  const missing = REQUIRED_FILES.filter(
    (filePath) => !checkFile(filePath)
  );

  if (missing.length > 0) {
    console.error(
      "Health check failed."
    );

    console.error(
      "Missing files:"
    );

    for (const file of missing) {
      console.error(`- ${file}`);
    }

    process.exitCode = 1;
    return false;
  }

  console.log(
    "Zeka Bot health check passed."
  );

  console.log(
    `Checked ${REQUIRED_FILES.length} required files.`
  );

  return true;
}

if (require.main === module) {
  runHealthCheck();
}

module.exports = {
  checkFile,
  runHealthCheck,
};
