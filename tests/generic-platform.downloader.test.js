const test = require("node:test");
const assert = require("node:assert/strict");
const { downloadPlatformMedia, detectContentType } = require("../services/generic-platform.downloader");

test("generic downloader rejects unsupported platform", async () => {
  await assert.rejects(
    () => downloadPlatformMedia({ platform: "unknown", url: "https://example.com/a", jobId: "test" }),
    /Unsupported platform/
  );
});

test("generic downloader rejects mismatched host", async () => {
  await assert.rejects(
    () => downloadPlatformMedia({ platform: "reddit", url: "https://example.com/a", jobId: "test" }),
    /Unsupported reddit URL/
  );
});

test("generic downloader rejects non-HTTPS URL", async () => {
  await assert.rejects(
    () => downloadPlatformMedia({ platform: "vimeo", url: "http://vimeo.com/123", jobId: "test" }),
    /Unsupported vimeo URL/
  );
});

test("generic downloader recognizes MP3 output", () => {
  assert.equal(detectContentType("/tmp/zeka-audio.mp3"), "AUDIO");
});
