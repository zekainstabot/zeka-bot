const test = require("node:test");
const assert = require("node:assert/strict");

const {
  processJob,
} = require("../workers/job.worker");

test("job worker exposes processJob", () => {
  assert.equal(
    typeof processJob,
    "function"
  );
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
  await assert.rejects(
    () =>
      processJob({
        id: 1,
        job_id: "test-job",
        platform: "unsupported",
      }),
    /Unsupported platform: unsupported/
  );
});
