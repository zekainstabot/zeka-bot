const test = require("node:test");
const assert = require("node:assert/strict");
const {
  downloadYouTubeMedia,
  buildYtDlpOptions,
} = require("../services/youtube.downloader");

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

test("YouTube downloader builds options for the installed yt-dlp executable", () => {
  const options = buildYtDlpOptions("/tmp/zeka-youtube/test/%(id)s.%(ext)s");

  assert.equal(options.output, "/tmp/zeka-youtube/test/%(id)s.%(ext)s");
  assert.equal(options.noPlaylist, true);
  assert.equal(options.writeInfoJson, true);
  assert.equal(options.mergeOutputFormat, "mp4");
  assert.equal(options.socketTimeout, 30);
  assert.equal(options.retries, 2);
  assert.equal(options.fragmentRetries, 2);
  assert.equal(typeof options.extractorArgs, "string");
});

test("YouTube downloader requires URL and job ID", async () => {
  await assert.rejects(
    () => downloadYouTubeMedia({ url: "", jobId: "youtube-test" }),
    /YouTube URL and job ID are required/
  );
});
