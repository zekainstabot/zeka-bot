const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getMigrationFiles,
} = require("../database/migrator");

test("migration runner exposes getMigrationFiles", () => {
  assert.equal(
    typeof getMigrationFiles,
    "function"
  );
});

test("migration files are returned in sorted order", () => {
  const files = getMigrationFiles();

  assert.equal(
    Array.isArray(files),
    true
  );

  assert.ok(
    files.length > 0
  );

  const sorted = [...files].sort(
    (a, b) => a.localeCompare(b)
  );

  assert.deepEqual(
    files,
    sorted
  );
});

test("migration files contain only SQL files", () => {
  const files = getMigrationFiles();

  for (const file of files) {
    assert.equal(
      file.endsWith(".sql"),
      true
    );
  }
});

test("first migration exists", () => {
  const files = getMigrationFiles();

  assert.equal(
    files.includes("001_create_users.sql"),
    true
  );
});

test("request and job migrations exist", () => {
  const files = getMigrationFiles();

  assert.equal(
    files.includes("004_create_requests.sql"),
    true
  );

  assert.equal(
    files.includes("005_create_jobs.sql"),
    true
  );
});
