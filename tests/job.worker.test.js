const test = require("node:test");
const assert = require("node:assert/strict");

const {
  processJob,
  createJobWorker,
} = require("../workers/job.worker");

function createHarness({
  reservedCost = 2,
  sendError = null,
  downloadError = null,
  missingMessageId = false,
  consumeError = null,
  completeError = null,
  queueError = null,
} = {}) {
  const calls = [];

  const dependencies = {
    userRepository: {
      async findById(userId) {
        calls.push(`user:${userId}`);

        return {
          id: userId,
          telegram_user_id: 9001,
        };
      },
    },

    async downloadInstagram() {
      calls.push("download");

      if (downloadError) {
        throw downloadError;
      }

      return {
        success: true,
        filePath: "/tmp/job-video.mp4",
        contentType: "video",
        caption: "Test caption",
        finalCost: reservedCost,
      };
    },

    async downloadTikTok() {
      calls.push("download");

      if (downloadError) {
        throw downloadError;
      }

      return {
        success: true,
        filePath: "/tmp/job-video.mp4",
        contentType: "video",
        caption: "Test caption",
        finalCost: reservedCost,
      };
    },

    async sendFileToUser() {
      calls.push("send");

      if (sendError) {
        throw sendError;
      }

      if (missingMessageId) {
        return {
          response: {
            result: {},
          },
        };
      }

      return {
        response: {
          result: {
            message_id: 12345,
          },
        },
      };
    },

    deliveryRepository: {
      async createPending() {
        calls.push("delivery:pending");
      },

      async markSent() {
        calls.push("delivery:sent");
      },

      async markUnknown() {
        calls.push("delivery:unknown");
      },
    },

    mediaRepository: {
      async findByJobId() {
        calls.push("media:lookup");
        return null;
      },
    },

    async enqueueForReview() {
      calls.push("media:enqueue");

      if (queueError) {
        throw queueError;
      }

      return null;
    },

    async markSending() {
      calls.push("job:sending");
    },

    async markCompleted(jobId, data) {
      calls.push(`job:completed:${jobId}:${data.finalCost}`);

      if (completeError) {
        throw completeError;
      }

      return {
        id: jobId,
        status: "COMPLETED",
      };
    },

    async markFailed() {
      calls.push("job:failed");
    },

    async deleteFile(filePath) {
      calls.push(`file:delete:${filePath}`);
    },

    async consumeCredit(jobId) {
      calls.push(`credit:consume:${jobId}`);

      if (consumeError) {
        throw consumeError;
      }
    },

    async releaseCredit(jobId) {
      calls.push(`credit:release:${jobId}`);
    },
  };

  const worker = createJobWorker(dependencies);

  return {
    processJob: worker.processJob,
    calls,
    dependencies,
  };
}

const validJob = {
  id: 101,
  job_id: "job-101",
  user_id: 55,
  platform: "instagram",
  reserved_cost: 2,
  normalized_url: "https://example.com/video",
};

test("job worker exposes processJob", () => {
  assert.equal(typeof processJob, "function");
});

test("job worker exposes createJobWorker", () => {
  assert.equal(typeof createJobWorker, "function");
});

test("job worker rejects a missing job", async () => {
  await assert.rejects(
    () => processJob(null),
    /Valid job is required/
  );
});

test("job worker rejects a job without an id", async () => {
  await assert.rejects(
    () =>
      processJob({
        platform: "instagram",
      }),
    /Valid job is required/
  );
});

test("job worker rejects unsupported platforms", async () => {
  const { processJob, calls } = createHarness();

  await assert.rejects(
    () =>
      processJob({
        ...validJob,
        platform: "unsupported",
      }),
    /Unsupported platform: unsupported/
  );

  assert.ok(calls.includes("job:failed"));
  assert.ok(calls.includes("credit:release:101"));
});

test("successful delivery consumes credit and completes the job", async () => {
  const { processJob, calls } = createHarness();

  const result = await processJob(validJob);

  assert.equal(result.success, true);
  assert.equal(result.delivered, true);
  assert.equal(result.creditConsumed, true);
  assert.equal(result.telegramMessageId, 12345);

  assert.ok(calls.includes("delivery:sent"));
  assert.ok(calls.includes("credit:consume:101"));
  assert.ok(calls.includes("job:completed:101:2"));

  assert.equal(calls.includes("job:failed"), false);
  assert.equal(calls.includes("credit:release:101"), false);
});

test("credit consumption failure preserves reservation and leaves job in SENDING", async () => {
  const { processJob, calls } = createHarness({
    consumeError: new Error("Credit database failure"),
  });

  const result = await processJob(validJob);

  assert.equal(result.success, false);
  assert.equal(result.delivered, true);
  assert.equal(result.creditPending, true);

  assert.ok(calls.includes("delivery:sent"));
  assert.ok(calls.includes("credit:consume:101"));

  assert.equal(calls.includes("credit:release:101"), false);
  assert.equal(calls.includes("job:failed"), false);

  assert.equal(
    calls.some((call) => call.startsWith("job:completed:")),
    false
  );
});

test("completion failure after credit consumption leaves job for recovery", async () => {
  const { processJob, calls } = createHarness({
    completeError: new Error("Completion database failure"),
  });

  const result = await processJob(validJob);

  assert.equal(result.success, false);
  assert.equal(result.delivered, true);
  assert.equal(result.creditConsumed, true);
  assert.equal(result.reconciliationPending, true);

  assert.ok(calls.includes("credit:consume:101"));
  assert.ok(calls.includes("job:completed:101:2"));

  assert.equal(calls.includes("credit:release:101"), false);
  assert.equal(calls.includes("job:failed"), false);
});

test("completion failure for a free job leaves it for recovery", async () => {
  const { processJob, calls } = createHarness({
    reservedCost: 0,
    completeError: new Error("Completion database failure"),
  });

  const result = await processJob({
    ...validJob,
    reserved_cost: 0,
  });

  assert.equal(result.success, false);
  assert.equal(result.delivered, true);
  assert.equal(result.creditConsumed, false);
  assert.equal(result.reconciliationPending, true);

  assert.equal(calls.includes("credit:consume:101"), false);
  assert.equal(calls.includes("credit:release:101"), false);
  assert.equal(calls.includes("job:failed"), false);

  assert.ok(calls.includes("job:completed:101:0"));
});

test("unknown Telegram delivery preserves credit and does not fail the job", async () => {
  const { processJob, calls } = createHarness({
    missingMessageId: true,
  });

  const result = await processJob(validJob);

  assert.equal(result.success, false);
  assert.equal(result.delivered, false);
  assert.equal(result.deliveryUnknown, true);

  assert.ok(calls.includes("delivery:unknown"));

  assert.equal(calls.includes("credit:consume:101"), false);
  assert.equal(calls.includes("credit:release:101"), false);
  assert.equal(calls.includes("job:failed"), false);
});

test("Telegram send failure marks delivery UNKNOWN and releases reserved credit", async () => {
  const { processJob, calls } = createHarness({
    sendError: new Error("Telegram network failure"),
  });

  await assert.rejects(
    () => processJob(validJob),
    /Telegram network failure/
  );

  assert.ok(calls.includes("delivery:unknown"));
  assert.ok(calls.includes("credit:release:101"));
  assert.ok(calls.includes("job:failed"));
});

test("download failure releases reserved credit and marks job failed", async () => {
  const { processJob, calls } = createHarness({
    downloadError: new Error("Download failed"),
  });

  await assert.rejects(
    () => processJob(validJob),
    /Download failed/
  );

  assert.ok(calls.includes("download"));
  assert.ok(calls.includes("credit:release:101"));
  assert.ok(calls.includes("job:failed"));

  assert.equal(calls.includes("send"), false);
  assert.equal(calls.includes("credit:consume:101"), false);
});

test("worker deletes downloaded file after normal completion", async () => {
  const { processJob, calls } = createHarness();

  await processJob(validJob);

  assert.ok(
    calls.includes("file:delete:/tmp/job-video.mp4")
  );
});

test("worker preserves a file successfully queued for review", async () => {
  const calls = [];

  const worker = createJobWorker({
    userRepository: {
      async findById() {
        return {
          telegram_user_id: 9001,
        };
      },
    },

    async downloadInstagram() {
      return {
        success: true,
        filePath: "/tmp/review-video.mp4",
        contentType: "video",
        caption: "Review",
      };
    },

    async sendFileToUser() {
      return {
        response: {
          result: {
            message_id: 12345,
          },
        },
      };
    },

    deliveryRepository: {
      async createPending() {},
      async markSent() {},
      async markUnknown() {},
    },

    async markSending() {},

    async consumeCredit() {},

    async enqueueForReview() {
      return {
        status: "PENDING",
        file_path: "/tmp/review-video.mp4",
      };
    },

    async markCompleted() {},

    async deleteFile(path) {
      calls.push(`delete:${path}`);
    },
  });

  const result = await worker.processJob(validJob);

  assert.equal(result.zekaMediaQueued, true);

  assert.equal(
    calls.includes("delete:/tmp/review-video.mp4"),
    false
  );
});
