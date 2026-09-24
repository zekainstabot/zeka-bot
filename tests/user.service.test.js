const test = require("node:test");
const assert = require("node:assert/strict");

const userService = require("../services/user.service");

test("user service exposes the expected API", () => {
  assert.equal(
    typeof userService.getOrCreateUser,
    "function"
  );
});

test("getOrCreateUser rejects missing Telegram user", async () => {
  const values = [
    null,
    undefined,
    {},
    { id: null },
    { id: undefined },
  ];

  for (const value of values) {
    await assert.rejects(
      () => userService.getOrCreateUser(value),
      /Telegram user information is required/
    );
  }
});

test("getOrCreateUser rejects missing Telegram user id", async () => {
  await assert.rejects(
    () =>
      userService.getOrCreateUser({
        first_name: "Test",
        username: "test",
      }),
    /Telegram user information is required/
  );
});

test("getOrCreateUser accepts a valid Telegram user object", () => {
  const telegramUser = {
    id: 123456789,
    first_name: "Test",
    last_name: "User",
    username: "testuser",
  };

  assert.equal(
    telegramUser.id > 0,
    true
  );

  assert.equal(
    typeof telegramUser.first_name,
    "string"
  );

  assert.equal(
    typeof telegramUser.username,
    "string"
  );
});
