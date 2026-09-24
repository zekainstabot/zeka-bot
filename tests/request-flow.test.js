const test = require("node:test");
const assert = require("node:assert/strict");

const requestService = require("../services/request.service");
const queueManager = require("../queue/manager");

test.afterEach(() => {
  queueManager.clear();
  queueManager.resetProcessor();
});

test("request service validates required fields", async () => {
  await assert.rejects(
    () =>
      requestService.createDownloadRequest({
        platform: "instagram",
        originalUrl:
          "https://www.instagram.com/reel/test/",
      }),
    /User ID is required/
  );

  await assert.rejects(
    () =>
      requestService.createDownloadRequest({
        userId: 1,
        originalUrl:
          "https://www.instagram.com/reel/test/",
      }),
    /Platform is required/
  );

  await assert.rejects(
    () =>
      requestService.createDownloadRequest({
        userId: 1,
        platform: "instagram",
      }),
    /Original URL is required/
  );
});

test("request service exposes request lookup methods", () => {
  assert.equal(
    typeof requestService.getRequestById,
    "function"
  );

  assert.equal(
    typeof requestService.getRequestByRequestId,
    "function"
  );

  assert.equal(
    typeof requestService.updateRequestStatus,
    "function"
  );
});

test("queue manager is ready for request jobs", () => {
  assert.equal(
    queueManager.getLength(),
    0
  );

  assert.ok(
    queueManager.getMaxConcurrent() > 0
  );
});
