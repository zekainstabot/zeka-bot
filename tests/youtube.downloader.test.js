const test = require("node:test");
const assert = require("node:assert/strict");
const { downloadYouTubeMedia } = require("../services/youtube.downloader");

test("YouTube downloader rejects non-YouTube hosts", async () => {
  await assert.rejects(
    () => downloadYouTubeMedia({
      url: "https://example.com/video",
      jobId: "youtube-test",
    }),
    /Unsupported YouTube URL/
  );
});

test("YouTube downloader rejects non-HTTPS URLs", async () => {
  await assert.rejects(
    () => downloadYouTubeMedia({
      url: "http://youtube.com/watch?v=abcdefghijk",
      jobId: "youtube-test",
    }),
    /Unsupported YouTube URL/
  );
});

test("YouTube downloader requires URL and job ID", async () => {
  await assert.rejects(
    () => downloadYouTubeMedia({ url: "", jobId: "youtube-test" }),
    /YouTube URL and job ID are required/
  );
});
