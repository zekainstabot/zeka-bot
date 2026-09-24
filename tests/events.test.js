const test = require("node:test");
const assert = require("node:assert/strict");

const events = require("../core/events");

test("events exposes the expected API", () => {
  assert.equal(typeof events.on, "function");
  assert.equal(typeof events.off, "function");
  assert.equal(typeof events.emit, "function");
  assert.equal(typeof events.clear, "function");
});

test("events registers and emits handlers", async () => {
  events.clear();

  let received = null;

  events.on("test:event", async (payload) => {
    received = payload;
  });

  await events.emit("test:event", {
    value: 123,
  });

  assert.deepEqual(received, {
    value: 123,
  });

  events.clear();
});

test("events unsubscribe works", async () => {
  events.clear();

  let callCount = 0;

  const handler = () => {
    callCount += 1;
  };

  const unsubscribe = events.on(
    "test:unsubscribe",
    handler
  );

  await events.emit("test:unsubscribe");

  assert.equal(callCount, 1);

  assert.equal(
    unsubscribe(),
    true
  );

  await events.emit("test:unsubscribe");

  assert.equal(callCount, 1);

  events.clear();
});

test("events off removes a registered handler", async () => {
  events.clear();

  let callCount = 0;

  const handler = () => {
    callCount += 1;
  };

  events.on("test:off", handler);

  assert.equal(
    events.off("test:off", handler),
    true
  );

  await events.emit("test:off");

  assert.equal(callCount, 0);

  events.clear();
});

test("events rejects invalid handlers", () => {
  assert.throws(
    () => events.on("test:invalid", null),
    /Event handler must be a function/
  );
});
