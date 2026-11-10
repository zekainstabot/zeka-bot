const test = require("node:test");
const assert = require("node:assert/strict");
const { detectFileContentType } = require("../services/tiktok.downloader");

test("TikTok downloader recognizes MP3 output", () => {
  assert.equal(detectFileContentType("/tmp/zeka-audio.mp3"), "AUDIO");
});
