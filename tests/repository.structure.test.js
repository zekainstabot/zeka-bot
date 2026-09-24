const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const REQUIRED_DIRECTORIES = [
  "config",
  "core",
  "database",
  "handlers",
  "localization",
  "monitoring",
  "navigation",
  "queue",
  "repositories",
  "scheduler",
  "scripts",
  "security",
  "services",
  "tests",
  "workers",
];

const REQUIRED_FILES = [
  "app.js",
  "bot.js",

  "config/app.js",
  "config/database.js",
  "config/features.js",
  "config/queue.js",
  "config/storage.js",

  "database/client.js",
  "database/pool.js",
  "database/migrator.js",
  "database/bootstrap.js",

  "core/errors/index.js",
  "core/events/index.js",
  "core/idempotency/index.js",
  "core/locks/index.js",
  "core/logger/index.js",
  "core/shutdown/index.js",

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

  "scripts/health-check.js",
];

test("required project directories exist", () => {
  for (const directory of REQUIRED_DIRECTORIES) {
    const directoryPath = path.join(
      process.cwd(),
      directory
    );

    assert.equal(
      fs.existsSync(directoryPath),
      true,
      `Missing directory: ${directory}`
    );

    assert.equal(
      fs.statSync(directoryPath).isDirectory(),
      true,
      `Not a directory: ${directory}`
    );
  }
});

test("required project files exist", () => {
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(
      process.cwd(),
      file
    );

    assert.equal(
      fs.existsSync(filePath),
      true,
      `Missing file: ${file}`
    );

    assert.equal(
      fs.statSync(filePath).isFile(),
      true,
      `Not a file: ${file}`
    );
  }
});

test("required project files are not empty", () => {
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(
      process.cwd(),
      file
    );

    const content = fs
      .readFileSync(filePath, "utf8")
      .trim();

    assert.ok(
      content.length > 0,
      `Empty required file: ${file}`
    );
  }
});
