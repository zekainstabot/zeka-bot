const test = require("node:test");
const assert = require("node:assert/strict");

const databaseClient = require("../database/client");

test("database client exposes the expected API", () => {
  assert.equal(
    typeof databaseClient.getClient,
    "function"
  );

  assert.equal(
    typeof databaseClient.setClient,
    "function"
  );

  assert.equal(
    typeof databaseClient.checkConnection,
    "function"
  );

  assert.equal(
    typeof databaseClient.close,
    "function"
  );
});

test("database client exposes configuration", () => {
  assert.equal(
    typeof databaseClient.config,
    "object"
  );

  assert.equal(
    "url" in databaseClient.config,
    true
  );

  assert.equal(
    "pool" in databaseClient.config,
    true
  );
});

test("setClient rejects a missing client", () => {
  assert.throws(
    () => databaseClient.setClient(null),
    /Database client is required/
  );
});

test("setClient rejects an invalid client", () => {
  assert.throws(
    () =>
      databaseClient.setClient({
        connect: () => {},
      }),
    /Database client must provide a query\(\) method/
  );
});

test("setClient accepts an object with query method", () => {
  const fakeClient = {
    query: async () => ({
      rows: [],
    }),
  };

  assert.doesNotThrow(() => {
    databaseClient.setClient(fakeClient);
  });
});
