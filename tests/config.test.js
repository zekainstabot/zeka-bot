const test = require("node:test");
const assert = require("node:assert/strict");

const appConfig = require("../config/app");
const databaseConfig = require("../config/database");
const queueConfig = require("../config/queue");
const features = require("../config/features");
const storageConfig = require("../config/storage");

test("app config exposes expected structure", () => {
  assert.equal(
    typeof appConfig.environment,
    "string"
  );

  assert.equal(
    typeof appConfig.bot,
    "object"
  );

  assert.equal(
    typeof appConfig.bot.token,
    "string"
  );

  assert.equal(
    typeof appConfig.logging,
    "object"
  );

  assert.equal(
    typeof appConfig.logging.level,
    "string"
  );
});

test("database config exposes expected structure", () => {
  assert.equal(
    typeof databaseConfig.url,
    "string"
  );

  assert.equal(
    typeof databaseConfig.pool,
    "object"
  );

  assert.ok(
    databaseConfig.pool.min >= 0
  );

  assert.ok(
    databaseConfig.pool.max >=
      databaseConfig.pool.min
  );

  assert.equal(
    typeof databaseConfig.ssl,
    "boolean"
  );
});

test("queue config exposes valid limits", () => {
  assert.ok(
    queueConfig.normal.maxConcurrent > 0
  );

  assert.ok(
    queueConfig.heavy.maxProcessesPerHour > 0
  );

  assert.ok(
    queueConfig.retry.maxAttempts > 0
  );

  assert.ok(
    queueConfig.retry.delayMs >= 0
  );

  assert.ok(
    queueConfig.cooldown.downloadRequestMs >= 0
  );
});

test("feature config exposes platform flags", () => {
  assert.equal(
    typeof features.instagram,
    "boolean"
  );

  assert.equal(
    typeof features.tiktok,
    "boolean"
  );

  assert.equal(
    typeof features.youtube,
    "boolean"
  );

  assert.equal(
    typeof features.facebook,
    "boolean"
  );

  assert.equal(
    typeof features.x,
    "boolean"
  );

  assert.equal(
    typeof features.pinterest,
    "boolean"
  );
});

test("storage config exposes valid values", () => {
  assert.ok(
    storageConfig.maxUsagePercent > 0
  );

  assert.ok(
    storageConfig.maxUsagePercent <= 100
  );

  assert.ok(
    storageConfig.cleanupIntervalMinutes > 0
  );
});
