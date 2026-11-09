const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(
  process.cwd(),
  "database",
  "migrations"
);

test("migrations directory exists", () => {
  assert.equal(
    fs.existsSync(MIGRATIONS_DIR),
    true
  );

  assert.equal(
    fs.statSync(MIGRATIONS_DIR).isDirectory(),
    true
  );
});

test("migration files use numeric ordering", () => {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  assert.ok(
    files.length > 0,
    "No migration files found"
  );

  for (const file of files) {
    assert.match(
      file,
      /^\d+_.+\.sql$/,
      `Invalid migration filename: ${file}`
    );
  }
});

test("migration filenames are unique and numeric prefixes are valid", () => {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"));

  const numbers = files.map((file) =>
    Number(file.match(/^(\\d+)_/)[1])
  );

  assert.equal(new Set(files).size, files.length);
  assert.ok(numbers.every((number) => Number.isSafeInteger(number) && number > 0));
});

test("migration files are not empty", () => {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"));

  for (const file of files) {
    const content = fs
      .readFileSync(
        path.join(MIGRATIONS_DIR, file),
        "utf8"
      )
      .trim();

    assert.ok(
      content.length > 0,
      `Empty migration: ${file}`
    );
  }
});
