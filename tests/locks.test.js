const test = require("node:test");
const assert = require("node:assert/strict");

const locks = require("../core/locks");

test("locks exposes the expected API", () => {
  assert.equal(typeof locks.acquire, "function");
  assert.equal(typeof locks.release, "function");
  assert.equal(typeof locks.isLocked, "function");
  assert.equal(typeof locks.clear, "function");
});

test("lock can be acquired", () => {
  locks.clear();

  assert.equal(
    locks.acquire("test-lock", "owner-1"),
    true
  );

  assert.equal(
    locks.isLocked("test-lock"),
    true
  );

  locks.clear();
});

test("locked key cannot be acquired by another owner", () => {
  locks.clear();

  assert.equal(
    locks.acquire("test-lock", "owner-1"),
    true
  );

  assert.equal(
    locks.acquire("test-lock", "owner-2"),
    false
  );

  locks.clear();
});

test("owner can release its lock", () => {
  locks.clear();

  locks.acquire("test-lock", "owner-1");

  assert.equal(
    locks.release("test-lock", "owner-1"),
    true
  );

  assert.equal(
    locks.isLocked("test-lock"),
    false
  );

  locks.clear();
});

test("wrong owner cannot release a lock", () => {
  locks.clear();

  locks.acquire("test-lock", "owner-1");

  assert.equal(
    locks.release("test-lock", "owner-2"),
    false
  );

  assert.equal(
    locks.isLocked("test-lock"),
    true
  );

  locks.clear();
});

test("expired lock can be acquired again", async () => {
  locks.clear();

  assert.equal(
    locks.acquire(
      "expiring-lock",
      "owner-1",
      20
    ),
    true
  );

  await new Promise((resolve) =>
    setTimeout(resolve, 30)
  );

  assert.equal(
    locks.isLocked("expiring-lock"),
    false
  );

  assert.equal(
    locks.acquire(
      "expiring-lock",
      "owner-2"
    ),
    true
  );

  locks.clear();
});
