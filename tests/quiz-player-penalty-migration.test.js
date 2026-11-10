const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("quiz player net credit constraint permits accumulated penalties", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "database", "migrations", "197_allow_accumulated_quiz_penalties.sql"),
    "utf8"
  );

  assert.match(sql, /DROP CONSTRAINT IF EXISTS game_session_players_reward_check/i);
  assert.match(sql, /CHECK\s*\(\s*credit_reward\s*>=\s*-1000000\s*\)/i);
});
