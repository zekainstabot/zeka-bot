const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("quiz answer credit constraint permits the 0.25 incorrect-answer penalty", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "database", "migrations", "196_allow_quiz_credit_penalty.sql"),
    "utf8"
  );

  assert.match(sql, /DROP CONSTRAINT IF EXISTS game_answers_credit_reward_check/i);
  assert.match(sql, /CHECK\s*\(\s*credit_reward\s*>=\s*-0\.25\s*\)/i);
});
