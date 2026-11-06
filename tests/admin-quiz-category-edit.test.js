
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();

function readProjectFile(relativePath) {
  const filePath = path.join(ROOT, relativePath);

  assert.equal(
    fs.existsSync(filePath),
    true,
    `Missing file: ${relativePath}`
  );

  return fs.readFileSync(filePath, "utf8");
}

test("editor preserves existing category ID", () => {
  const source = readProjectFile(
    "handlers/admin-quiz/question-editor.js"
  );

  assert.match(
    source,
    /categoryId:\s*question\.category_id\s*\?\s*Number\(question\.category_id\)\s*:\s*null/
  );
});

test("edit flow stores selected category ID", () => {
  const source = readProjectFile(
    "handlers/admin-quiz.handler.js"
  );

  assert.match(
    source,
    /state\.data\.categoryId\s*=\s*category\.id/
  );
});

test("edit payload forwards category ID", () => {
  const source = readProjectFile(
    "handlers/admin-quiz.handler.js"
  );

  assert.match(
    source,
    /categoryId:\s*data\.categoryId/
  );

  assert.match(
    source,
    /updateQuestionFromReport\(\s*updateData\s*\)/
  );

  assert.match(
    source,
    /updateQuestion\(\s*updateData\s*\)/
  );
});

test("both edit services resolve the selected category", () => {
  const source = readProjectFile(
    "services/admin-quiz.service.js"
  );

  for (const name of [
    "updateQuestion",
    "updateQuestionFromReport",
  ]) {
    const start = source.indexOf(
      `async function ${name}`
    );

    assert.notEqual(start, -1);

    const end = source.indexOf(
      "\nasync function ",
      start + 1
    );

    const fn = source.slice(
      start,
      end === -1 ? undefined : end
    );

    assert.match(
      fn,
      /resolveCategory\(\s*categoryId\s*\)/
    );

    assert.match(
      fn,
      /categoryId:\s*selectedCategory\s*\?\s*selectedCategory\.id\s*:\s*null/
    );
  }
});

test("repository preserves old category ID when no new ID is provided", () => {
  const source = readProjectFile(
    "repositories/admin-quiz.repository.js"
  );

  assert.match(
    source,
    /category_id\s*=\s*COALESCE\(\$3,\s*category_id\)/i
  );
});
