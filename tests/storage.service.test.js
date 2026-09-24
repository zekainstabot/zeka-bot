const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const fileService = require("../services/file.service");

test("file service exposes required methods", () => {
  assert.equal(
    typeof fileService.deleteFile,
    "function"
  );
});

test("deleteFile handles a missing file safely", async () => {
  const missingFile = path.join(
    os.tmpdir(),
    `zeka-missing-${Date.now()}.tmp`
  );

  await assert.doesNotReject(
    () => fileService.deleteFile(missingFile)
  );
});

test("deleteFile removes an existing file", async () => {
  const filePath = path.join(
    os.tmpdir(),
    `zeka-test-${Date.now()}.tmp`
  );

  fs.writeFileSync(
    filePath,
    "zeka-test"
  );

  assert.equal(
    fs.existsSync(filePath),
    true
  );

  await fileService.deleteFile(filePath);

  assert.equal(
    fs.existsSync(filePath),
    false
  );
});
