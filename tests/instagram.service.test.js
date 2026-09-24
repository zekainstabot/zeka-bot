const test = require("node:test");
const assert = require("node:assert/strict");

const {
  downloadInstagram,
} = require("../services/instagram.service");

test("instagram service exposes the expected API", () => {
  assert.equal(
    typeof downloadInstagram,
    "function"
  );
});

test("downloadInstagram rejects missing job", async () => {
  await assert.rejects(
    () => downloadInstagram(null),
    /Valid Instagram job is required/
  );
});

test("downloadInstagram rejects job without id", async () => {
  await assert.rejects(
    () =>
      downloadInstagram({
        job_id: "test-job",
      }),
    /Valid Instagram job is required/
  );
});

test("downloadInstagram rejects job without URL", async () => {
  await assert.rejects(
    () =>
      downloadInstagram({
        id: 1,
        job_id: "test-job",
      }),
    /Instagram URL is required/
  );
});
