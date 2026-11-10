const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("friend quiz migration creates isolated duel tables and debt references", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "database", "migrations", "198_create_friend_quiz_duels.sql"),
    "utf8"
  );

  assert.match(sql, /CREATE TABLE IF NOT EXISTS friend_quiz_rooms/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS friend_quiz_players/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS friend_quiz_answers/i);
  assert.match(sql, /UNIQUE\s*\(room_id, user_id\)/i);
  assert.match(sql, /UNIQUE\s*\(player_id, round_number\)/i);
  assert.match(sql, /source_type VARCHAR\(30\)/i);
  assert.match(sql, /source_id BIGINT/i);
  assert.match(sql, /expires_at TIMESTAMPTZ/i);
});

test("friend quiz handler can be loaded and exposes lifecycle cleanup", () => {
  const handler = require("../games/friend-quiz/friend-quiz.handler");
  assert.equal(typeof handler.createFriendQuizHandler, "function");
  assert.equal(typeof handler.handleStartPayload, "function");
  assert.equal(typeof handler.cleanupFriendQuizTimers, "function");
});

test("friend quiz service keeps duel rewards separate from regular quiz rewards", () => {
  const service = require("../games/friend-quiz/friend-quiz.service");

  assert.equal(service.TOTAL_ROUNDS, 5);
  assert.equal(service.ROUND_SECONDS, 20);
  assert.equal(service.WINNER_REWARD, 5);
  assert.equal(service.LOSER_PENALTY, 3);
  assert.equal(typeof service.createRoom, "function");
  assert.equal(typeof service.submitAnswer, "function");
  assert.equal(typeof service.finishRoom, "function");
});
