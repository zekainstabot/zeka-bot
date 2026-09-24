const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const {
  fileExists,
  deleteFile,
} = require("../services/file.service");

test("fileExists returns true for an existing file", async () => {
  const filePath = path.join(
    os.tmpdir(),
    `zeka-test-${Date.now()}-exists.txt`
  );

  await fs.writeFile(filePath, "test");

  try {
    assert.equal(
      await fileExists(filePath),
      true
    );
  } finally {
    await fs.rm(filePath, {
      force: true,
    });
  }
});

test("fileExists returns false for a missing file", async () => {
  const filePath = path.join(
    os.tmpdir(),
    `zeka-test-${Date.now()}-missing.txt`
  );

  assert.equal(
    await fileExists(filePath),
    false
  );
});

test("deleteFile removes an existing file", async () => {
  const filePath = path.join(
    os.tmpdir(),
    `zeka-test-${Date.now()}-delete.txt`
  );

  await fs.writeFile(filePath, "test");

  const result = await deleteFile(filePath);

  assert.equal(result, true);
  assert.equal(
    await fileExists(filePath),
    false
  );
});

test("deleteFile returns false for a missing file", async () => {
  const filePath = path.join(
    os.tmpdir(),
    `zeka-test-${Date.now()}-missing-delete.txt`
  );

  assert.equal(
    await deleteFile(filePath),
    false
  );
});

test("fileExists returns false for an empty path", async () => {
  assert.equal(
    await fileExists(""),
    false
  );

  assert.equal(
    await fileExists(null),
    false
  );
});

test("deleteFile returns false for an empty path", async () => {
  assert.equal(
    await deleteFile(""),
    false
  );

  assert.equal(
    await deleteFile(null),
    false
  );
});
