"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { featuresMenu, mainMenu } = require("../config/bot-menus");
const { createVoiceConverterHandler } = require("../handlers/voice-converter.handler");
const { createNavigationHandler } = require("../handlers/navigation.handler");

test("shared special features menu includes all feature entry points and a back button", () => {
  const rows = featuresMenu.reply_markup.keyboard;
  const buttons = rows.flat();

  assert.ok(buttons.includes("🎵 جست‌وجوی آهنگ"));
  assert.ok(buttons.includes("📆 تقویم روز"));
  assert.ok(buttons.includes("🎙 تبدیل ویس"));
  assert.ok(buttons.includes("📢 مدیریت انتشار محتوا"));
  assert.ok(buttons.includes("🔙 بازگشت"));
});

test("voice converter does not register a competing special features menu", () => {
  const hears = [];
  const bot = {
    hears(trigger, handler) {
      hears.push({ trigger, handler });
    },
    on() {},
  };

  createVoiceConverterHandler({ bot });

  assert.equal(
    hears.filter(({ trigger }) => trigger === "🛠 امکانات ویژه").length,
    0
  );
});

test("back button returns the user to the persistent main menu", async () => {
  let handler;
  const bot = {
    hears(trigger, callback) {
      if (trigger === "🔙 بازگشت") handler = callback;
    },
  };
  let replyArgs;

  createNavigationHandler({ bot, mainMenu });
  await handler({
    reply: async (...args) => { replyArgs = args; },
  });

  assert.equal(replyArgs[0], "🏠 منوی اصلی");
  assert.equal(replyArgs[1], mainMenu);
  assert.equal(mainMenu.reply_markup.remove_keyboard, undefined);
});
