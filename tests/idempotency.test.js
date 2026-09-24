const test = require("node:test");
const assert = require("node:assert/strict");

const idempotency = require("../core/idempotency");

test("idempotency exposes the expected API", () => {
  assert.equal(typeof idempotency.has, "function");
  assert.equal(typeof idempotency.mark, "function");
  assert.equal(typeof idempotency.checkAndMark, "function");
  assert.equal(typeof idempotency.remove, "function");
  assert.equal(typeof idempotency.clear, "function");
});

test("idempotency marks and detects a key", () => {
  idempotency.clear();

  assert.equal(
    idempotency.has("test-key"),
    false
  );

  idempotency.mark("test-key");

  assert.equal(
    idempotency.has("test-key"),
    true
  );

  idempotency.clear();
});

test("checkAndMark accepts a new key once", () => {
  idempotency.clear();

  assert.equal(
    idempotency.checkAndMark("unique-key"),
    true
  );

  assert.equal(
    idempotency.checkAndMark("unique-key"),
    false
  );

  idempotency.clear();
});

test("remove deletes a processed key", () => {
  idempotency.clear();

  idempotency.mark("remove-key");

  assert.equal(
    idempotency.has("remove-key"),
    true
  );

  assert.equal(
    idempotency.remove("remove-key"),
    true
  );

  assert.equal(
    idempotency.has("remove-key"),
    false
  );

  assert.equal(
    idempotency.remove("remove-key"),
    false
  );

  idempotency.clear();
});

test("idempotency normalizes keys to strings", () => {
  idempotency.clear();

  idempotency.mark(12345);

  assert.equal(
    idempotency.has("12345"),
    true
  );

  assert.equal(
    idempotency.checkAndMark(12345),
    false
  );

  idempotency.clear();
});
