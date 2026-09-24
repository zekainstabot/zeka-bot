const test = require("node:test");
const assert = require("node:assert/strict");

const queueManager = require("../queue/manager");

test("queue manager exposes the expected API", () => {
  assert.equal(
    typeof queueManager.add,
    "function"
  );

  assert.equal(
    typeof queueManager.remove,
    "function"
  );

  assert.equal(
    typeof queueManager.clear,
    "function"
  );

  assert.equal(
    typeof queueManager.getLength,
    "function"
  );

  assert.equal(
    typeof queueManager.getActiveCount,
    "function"
  );

  assert.equal(
    typeof queueManager.getMaxConcurrent,
    "function"
  );

  assert.equal(
    typeof queueManager.processNext,
    "function"
  );
});

test("queue manager starts empty", () => {
  queueManager.clear();

  assert.equal(
    queueManager.getLength(),
    0
  );

  assert.equal(
    queueManager.getActiveCount(),
    0
  );
});

test("queue manager returns configured concurrency", () => {
  const maxConcurrent =
    queueManager.getMaxConcurrent();

  assert.equal(
    Number.isInteger(maxConcurrent),
    true
  );

  assert.ok(
    maxConcurrent > 0
  );
});

test("queue manager clear is safe when already empty", () => {
  queueManager.clear();
  queueManager.clear();

  assert.equal(
    queueManager.getLength(),
    0
  );
});

test("queue manager remove returns false for an unknown job", () => {
  queueManager.clear();

  const removed = queueManager.remove(
    "job-that-does-not-exist"
  );

  assert.equal(
    removed,
    false
  );

  assert.equal(
    queueManager.getLength(),
    0
  );
});
