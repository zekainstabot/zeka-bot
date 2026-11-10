const test = require("node:test");
const assert = require("node:assert/strict");

const {
  downloadInstagramMedia,
  detectFileContentType,
  getDownloadFormat,
} = require("../services/instagram.downloader");

test("instagram downloader exposes the expected API", () => {
  assert.equal(
    typeof downloadInstagramMedia,
    "function"
  );
});

test("downloadInstagramMedia rejects missing URL", async () => {
  await assert.rejects(
    () =>
      downloadInstagramMedia({
        jobId: "test-job",
      }),
    /Instagram URL is required/
  );
});

test("downloadInstagramMedia rejects missing job id", async () => {
  await assert.rejects(
    () =>
      downloadInstagramMedia({
        url: "https://www.instagram.com/reel/test/",
      }),
    /Job ID is required/
  );
});

test("downloadInstagramMedia rejects both missing URL and job id", async () => {
  await assert.rejects(
    () =>
      downloadInstagramMedia({}),
    /Instagram URL is required/
  );
});

test("Instagram audio-only mode selects an audio stream", () => {
  assert.equal(getDownloadFormat("AUDIO"), "bestaudio/best");
});

test("Instagram downloader recognizes MP3 output", () => {
  assert.equal(detectFileContentType("/tmp/zeka-audio.mp3"), "AUDIO");
});
