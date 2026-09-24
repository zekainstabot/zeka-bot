const test = require("node:test");
const assert = require("node:assert/strict");

const shutdown = require("../core/shutdown");

test.afterEach(() => {
  shutdown.reset();
});

test("shutdown exposes the expected API", () => {
  assert.equal(typeof shutdown.register, "function");
  assert.equal(typeof shutdown.shutdown, "function");
  assert.equal(
    typeof shutdown.isShuttingDown,
    "function"
  );
  assert.equal(typeof shutdown.reset, "function");
});

test("shutdown starts in a non-shutting-down state", () => {
  shutdown.reset();

  assert.equal(
    shutdown.isShuttingDown(),
    false
  );
});

test("registered handlers are executed during shutdown", async () => {
  shutdown.reset();

  const calls = [];

  shutdown.register(async (reason) => {
    calls.push(reason);
  });

  await shutdown.shutdown("TEST");

  assert.deepEqual(
    calls,
    ["TEST"]
  );

  assert.equal(
    shutdown.isShuttingDown(),
    true
  );
});

test("shutdown runs only once", async () => {
  shutdown.reset();

  let callCount = 0;

  shutdown.register(async () => {
    callCount += 1;
  });

  await shutdown.shutdown("FIRST");
  await shutdown.shutdown("SECOND");

  assert.equal(
    callCount,
    1
  );
});

test("shutdown continues when a handler fails", async () => {
  shutdown.reset();

  let successfulHandlerCalled = false;

  shutdown.register(async () => {
    throw new Error("test failure");
  });

  shutdown.register(async () => {
    successfulHandlerCalled = true;
  });

  await shutdown.shutdown("TEST");

  assert.equal(
    successfulHandlerCalled,
    true
  );
});

test("register rejects invalid handlers", () => {
  shutdown.reset();

  assert.throws(
    () => shutdown.register(null),
    /Shutdown handler must be a function/
  );
});

test("reset clears shutdown state and handlers", async () => {
  shutdown.reset();

  let callCount = 0;

  shutdown.register(async () => {
    callCount += 1;
  });

  await shutdown.shutdown("FIRST");

  shutdown.reset();

  await shutdown.shutdown("SECOND");

  assert.equal(
    callCount,
    2
  );
});
