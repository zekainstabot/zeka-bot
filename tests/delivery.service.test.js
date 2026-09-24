const test = require("node:test");
const assert = require("node:assert/strict");

const deliveryService =
  require("../services/delivery.service");

test("delivery service exposes the expected API", () => {
  assert.equal(
    typeof deliveryService.setBot,
    "function"
  );

  assert.equal(
    typeof deliveryService.getBot,
    "function"
  );

  assert.equal(
    typeof deliveryService.sendFileToUser,
    "function"
  );
});

test("getBot rejects access before bot initialization", () => {
  assert.throws(
    () => deliveryService.getBot(),
    /Telegram bot has not been initialized/
  );
});

test("setBot rejects missing bot", () => {
  assert.throws(
    () => deliveryService.setBot(null),
    /Telegram bot is required/
  );
});

test("sendFileToUser rejects missing Telegram user id", async () => {
  await assert.rejects(
    () =>
      deliveryService.sendFileToUser({
        filePath: "/tmp/test.mp4",
      }),
    /Telegram user ID is required/
  );
});

test("sendFileToUser rejects missing file path", async () => {
  await assert.rejects(
    () =>
      deliveryService.sendFileToUser({
        telegramUserId: "123456789",
      }),
    /File path is required/
  );
});
