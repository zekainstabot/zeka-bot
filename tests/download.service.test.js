const test = require("node:test");
const assert = require("node:assert/strict");

const downloadService =
  require("../services/download.service");

test("download service exposes the expected API", () => {
  assert.equal(
    typeof downloadService.markDownloading,
    "function"
  );

  assert.equal(
    typeof downloadService.markDownloaded,
    "function"
  );

  assert.equal(
    typeof downloadService.markSending,
    "function"
  );

  assert.equal(
    typeof downloadService.markCompleted,
    "function"
  );

  assert.equal(
    typeof downloadService.markFailed,
    "function"
  );
});

test("markDownloading rejects missing job id", async () => {
  await assert.rejects(
    () =>
      downloadService.markDownloading(null),
    /Job ID is required/
  );
});

test("markDownloaded rejects missing job id", async () => {
  await assert.rejects(
    () =>
      downloadService.markDownloaded(null),
    /Job ID is required/
  );
});

test("markSending rejects missing job id", async () => {
  await assert.rejects(
    () =>
      downloadService.markSending(null),
    /Job ID is required/
  );
});

test("markCompleted rejects missing job id", async () => {
  await assert.rejects(
    () =>
      downloadService.markCompleted(null),
    /Job ID is required/
  );
});

test("markFailed rejects missing job id", async () => {
  await assert.rejects(
    () =>
      downloadService.markFailed(null),
    /Job ID is required/
  );
});
