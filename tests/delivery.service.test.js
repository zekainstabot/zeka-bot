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

test("buildDeliveryCaption appends bot, channel and website details", () => {
  const caption = deliveryService.buildDeliveryCaption("فایل آماده شد");

  assert.equal(
    caption,
    "فایل آماده شد\\n\\n🤖 ربات: @zekagpt_bot\\n📢 کانال: @zeka_media\\n🌐 سایت: https://zeka-media.onrender.com"
  );
});

test("buildDeliveryCaption keeps Telegram caption within 1024 characters", () => {
  const caption = deliveryService.buildDeliveryCaption("الف".repeat(1500));

  assert.ok(caption.length <= 1024);
  assert.ok(caption.includes("@zekagpt_bot"));
  assert.ok(caption.includes("@zeka_media"));
  assert.ok(caption.includes("https://zeka-media.onrender.com"));
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
