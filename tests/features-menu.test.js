"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { featuresMenu } = require("../config/bot-menus");
const { createVoiceConverterHandler } = require("../handlers/voice-converter.handler");
test("shared special features menu includes all feature entry points", () => {
  const rows = featuresMenu.reply_markup.keyboard;
  const buttons = rows.flat();
  assert.ok(buttons.includes("🎵 جست‌وجوی آهنگ"));
  assert.ok(buttons.includes("📆 تقویم روز"));
  assert.ok(buttons.includes("🎙 تبدیل ویس"));
  assert.ok(buttons.includes("📢 مدیریت انتشار محتوا"));
});
test("voice converter does not register a competing special features menu", () => {
  const hears = [];
  const bot = { hears(trigger, handler) { hears.push({ trigger, handler }); }, on() {} };
  createVoiceConverterHandler({ bot });
  assert.equal(hears.filter(({ trigger }) => trigger === "🛠 امکانات ویژه").length, 0);
});
