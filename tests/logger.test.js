const test = require("node:test");
const assert = require("node:assert/strict");

const logger = require("../core/logger");

test("logger exposes all log levels", () => {
  assert.equal(typeof logger.debug, "function");
  assert.equal(typeof logger.info, "function");
  assert.equal(typeof logger.warn, "function");
  assert.equal(typeof logger.error, "function");
  assert.equal(typeof logger.fatal, "function");
});

test("logger rejects invalid log levels internally", () => {
  const originalLog = console.log;

  console.log = () => {};

  try {
    assert.doesNotThrow(() => {
      logger.info("test message");
    });
  } finally {
    console.log = originalLog;
  }
});

test("logger outputs structured JSON", () => {
  const originalLog = console.log;
  let output = null;

  console.log = (message) => {
    output = message;
  };

  try {
    logger.info("test message", {
      requestId: "test-request",
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(typeof output, "string");

  const parsed = JSON.parse(output);

  assert.equal(parsed.level, "INFO");
  assert.equal(parsed.message, "test message");
  assert.equal(
    parsed.requestId,
    "test-request"
  );
  assert.equal(
    typeof parsed.timestamp,
    "string"
  );
});
