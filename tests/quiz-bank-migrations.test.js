const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationsDir = path.join(
  process.cwd(),
  "database",
  "migrations"
);

function readMigration(name) {
  return fs.readFileSync(
    path.join(migrationsDir, name),
    "utf8"
  );
}

function countByDifficulty(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

test("Persian quiz bank normalization covers all 65 built-in questions", () => {
  const sql = readMigration(
    "192_normalize_complete_quiz_bank.sql"
  );

  const rows = [
    ...sql.matchAll(
      /^\s*\('(?:[^']|'')*', '(?:geography|history|science|sports|literature|art|religion|culture|technology|general)', '(EASY|MEDIUM|HARD)'\),?$/gm
    ),
  ];

  assert.equal(rows.length, 65);
  assert.deepEqual(
    countByDifficulty(rows.map((row) => row[1])),
    { EASY: 31, MEDIUM: 22, HARD: 12 }
  );
});

test("English quiz migration contains a matching 65-question bank", () => {
  const sql = readMigration(
    "193_add_complete_english_quiz_bank.sql"
  );

  const rows = [
    ...sql.matchAll(
      /^\s*\('(?:geography|history|science|sports|literature|art|religion|culture|technology|general)', '(EASY|MEDIUM|HARD)', '(?:[^']|'')*', '(?:[^']|'')*', '(?:[^']|'')*', '(?:[^']|'')*', '(?:[^']|'')*', '([ABCD])', '(?:[^']|'')*'\),?$/gm
    ),
  ];

  assert.equal(rows.length, 65);
  assert.ok(rows.every((row) => ["A", "B", "C", "D"].includes(row[2])));
  assert.deepEqual(
    countByDifficulty(rows.map((row) => row[1])),
    { EASY: 31, MEDIUM: 22, HARD: 12 }
  );
});
