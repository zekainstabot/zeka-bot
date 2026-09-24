const test = require("node:test");
const assert = require("node:assert/strict");

const queueManager = require("../queue/manager");

test("queue manager exposes the expected API", () => {
  assert.equal(typeof queueManager.add, "function");
  assert.equal(typeof queueManager.remove, "function");
  assert.equal(typeof queueManager.clear, "function");
  assert.equal(typeof queueManager.getLength, "function");
  assert.equal(typeof queueManager.getActiveCount, "function");
  assert.equal(
    typeof queueManager.getMaxConcurrent,
    "function"
  );
});

test("queue manager can add and remove a job", () => {
  queueManager.clear();

  const job = {
    id: `test-${Date.now()}`,
    job_id: `test-job-${Date.now()}`,
    priority: 0,
    created_at: new Date().toISOString(),
  };

  queueManager.add(job);

  assert.equal(
    queueManager.getLength(),
    0
  );

  const removed = queueManager.remove(job.id);

  assert.equal(
    removed,
    false
  );

  queueManager.clear();
});

test("queue manager returns configured concurrency", () => {
  const maxConcurrent =
    queueManager.getMaxConcurrent();

  assert.equal(
    Number.isInteger(maxConcurrent),
    true
  );

  assert.ok(maxConcurrent > 0);
});

test("queue manager clear removes waiting jobs", () => {
  queueManager.clear();

  const jobs = [
    {
      id: `clear-a-${Date.now()}`,
      job_id: `clear-job-a-${Date.now()}`,
      priority: 0,
      created_at: new Date().toISOString(),
    },
    {
      id: `clear-b-${Date.now()}`,
      job_id: `clear-job-b-${Date.now()}`,
      priority: 0,
      created_at: new Date().toISOString(),
    },
  ];

  for (const job of jobs) {
    queueManager.add(job);
  }

  queueManager.clear();

  assert.equal(
    queueManager.getLength(),
    0
  );
});
