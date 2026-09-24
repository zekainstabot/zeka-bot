const test = require("node:test");
const assert = require("node:assert/strict");

const queueManager = require("../queue/manager");

test.afterEach(() => {
  queueManager.clear();
  queueManager.resetProcessor();
});

test("queue manager exposes the expected API", () => {
  assert.equal(
    typeof queueManager.add,
    "function"
  );

  assert.equal(
    typeof queueManager.remove,
    "function"
  );

  assert.equal(
    typeof queueManager.clear,
    "function"
  );

  assert.equal(
    typeof queueManager.getLength,
    "function"
  );

  assert.equal(
    typeof queueManager.getActiveCount,
    "function"
  );

  assert.equal(
    typeof queueManager.getMaxConcurrent,
    "function"
  );

  assert.equal(
    typeof queueManager.setProcessor,
    "function"
  );

  assert.equal(
    typeof queueManager.resetProcessor,
    "function"
  );
});

test("queue manager processes a queued job", async () => {
  let processedJob = null;

  queueManager.setProcessor(async (job) => {
    processedJob = job;
  });

  const job = {
    id: "test-job-1",
    job_id: "test-job-1",
    priority: 0,
    created_at: new Date().toISOString(),
  };

  queueManager.add(job);

  await queueManager.processNext();

  await new Promise((resolve) =>
    setImmediate(resolve)
  );

  assert.equal(
    processedJob,
    job
  );

  assert.equal(
    queueManager.getLength(),
    0
  );

  assert.equal(
    queueManager.getActiveCount(),
    0
  );
});

test("queue manager removes a waiting job", async () => {
  let resolveProcessor;

  const processorPromise =
    new Promise((resolve) => {
      resolveProcessor = resolve;
    });

  queueManager.setProcessor(
    () => processorPromise
  );

  const job = {
    id: "test-remove-1",
    job_id: "test-remove-1",
    priority: 0,
    created_at: new Date().toISOString(),
  };

  queueManager.add(job);

  await new Promise((resolve) =>
    setImmediate(resolve)
  );

  const removed =
    queueManager.remove(job.id);

  assert.equal(
    removed,
    false
  );

  resolveProcessor();

  await new Promise((resolve) =>
    setImmediate(resolve)
  );

  assert.equal(
    queueManager.getActiveCount(),
    0
  );
});

test("queue manager returns configured concurrency", () => {
  const maxConcurrent =
    queueManager.getMaxConcurrent();

  assert.equal(
    Number.isInteger(maxConcurrent),
    true
  );

  assert.ok(
    maxConcurrent > 0
  );
});

test("queue manager clear removes waiting jobs", () => {
  let resolveProcessor;

  const processorPromise =
    new Promise((resolve) => {
      resolveProcessor = resolve;
    });

  queueManager.setProcessor(
    () => processorPromise
  );

  const job1 = {
    id: "clear-job-1",
    job_id: "clear-job-1",
    priority: 0,
    created_at: new Date().toISOString(),
  };

  const job2 = {
    id: "clear-job-2",
    job_id: "clear-job-2",
    priority: 0,
    created_at: new Date().toISOString(),
  };

  queueManager.add(job1);
  queueManager.add(job2);

  queueManager.clear();

  assert.equal(
    queueManager.getLength(),
    0
  );

  resolveProcessor();
});
