const test = require("node:test");
const assert = require("node:assert/strict");

const {
  checkFile,
  runHealthCheck,
} = require("../scripts/health-check");

test("health check exposes the expected API", () => {
  assert.equal(typeof checkFile, "function");
  assert.equal(typeof runHealthCheck, "function");
});

test("health check finds existing project files", () => {
  assert.equal(
    checkFile("app.js"),
    true
  );

  assert.equal(
    checkFile("bot.js"),
    true
  );

  assert.equal(
    checkFile("database/bootstrap.js"),
    true
  );

  assert.equal(
    checkFile("services/instagram.service.js"),
    true
  );
});

test("health check detects a missing file", () => {
  assert.equal(
    checkFile("this-file-does-not-exist.js"),
    false
  );
});
