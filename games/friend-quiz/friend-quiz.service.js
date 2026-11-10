const crypto = require("crypto");
const { getPool } = require("../../database/pool");
const quizRepository = require("../../repositories/quiz.repository");
const creditRepository = require("../../repositories/credit.repository");
const creditLedgerRepository = require("../../repositories/credit.ledger.repository");

const TOTAL_ROUNDS = 5;
const ROUND_SECONDS = 20;
const WINNER_REWARD = 5;
const LOSER_PENALTY = 3;

function createInviteCode() {
  return crypto.randomBytes(6).toString("base64url").toUpperCase();
}

async function createRoom({ userId, mode = "DM", groupChatId = null, languageCode = "fa" }) {
  if (!userId) throw new Error("USER_ID_REQUIRED");
  if (!["DM", "GROUP"].includes(mode)) throw new Error("INVALID_MODE");
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT r.id FROM friend_quiz_rooms r
       JOIN friend_quiz_players p ON p.room_id = r.id
       WHERE p.user_id = $1 AND (r.status = 'ACTIVE' OR (r.status = 'WAITING' AND r.expires_at > NOW()))
       LIMIT 1 FOR UPDATE OF r`,
      [userId]
    );
    if (existing.rows[0]) throw new Error("FRIEND_QUIZ_ALREADY_ACTIVE");

    const inviteCode = createInviteCode();
    const roomResult = await client.query(
      `INSERT INTO friend_quiz_rooms
       (invite_code, mode, creator_user_id, group_chat_id, language_code, total_rounds, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '1 day') RETURNING *`,
      [inviteCode, mode, userId, groupChatId, languageCode === "en" ? "en" : "fa", TOTAL_ROUNDS]
    );
    const room = roomResult.rows[0];
    await client.query(
      `INSERT INTO friend_quiz_players (room_id, user_id, player_number)
       VALUES ($1, $2, 1)`,
      [room.id, userId]
    );
    await client.query("COMMIT");
    return room;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getRoomByCode(code, client = null) {
  const db = client || getPool();
  const result = await db.query(
    "SELECT * FROM friend_quiz_rooms WHERE invite_code = $1 LIMIT 1",
    [String(code || "").trim().toUpperCase()]
  );
  return result.rows[0] || null;
}

async function getRoom(roomId, client = null) {
  const db = client || getPool();
  const roomResult = await db.query(
    "SELECT * FROM friend_quiz_rooms WHERE id = $1 LIMIT 1",
    [roomId]
  );
  const room = roomResult.rows[0];
  if (!room) return null;
  const playersResult = await db.query(
    `SELECT p.*, u.telegram_user_id, u.display_name, u.username
     FROM friend_quiz_players p
     JOIN users u ON u.id = p.user_id
     WHERE p.room_id = $1 ORDER BY p.player_number`,
    [roomId]
  );
  return { ...room, players: playersResult.rows };
}

async function joinRoom({ code, userId }) {
  if (!userId) throw new Error("USER_ID_REQUIRED");
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const roomResult = await client.query(
      "SELECT * FROM friend_quiz_rooms WHERE invite_code = $1 FOR UPDATE",
      [String(code || "").trim().toUpperCase()]
    );
    const room = roomResult.rows[0];
    if (!room) throw new Error("FRIEND_QUIZ_NOT_FOUND");
    if (room.status !== "WAITING") throw new Error("FRIEND_QUIZ_NOT_WAITING");
    if (room.expires_at && new Date(room.expires_at).getTime() <= Date.now()) throw new Error("FRIEND_QUIZ_EXPIRED");
    if (String(room.creator_user_id) === String(userId)) throw new Error("FRIEND_QUIZ_SELF_JOIN");
    const active = await client.query(
      `SELECT 1 FROM friend_quiz_players p
       JOIN friend_quiz_rooms r ON r.id = p.room_id
       WHERE p.user_id = $1 AND r.status IN ('WAITING', 'ACTIVE') LIMIT 1`,
      [userId]
    );
    if (active.rows.length) throw new Error("FRIEND_QUIZ_ALREADY_ACTIVE");
    await client.query(
      `INSERT INTO friend_quiz_players (room_id, user_id, player_number)
       VALUES ($1, $2, 2)`,
      [room.id, userId]
    );
    await client.query(
      "UPDATE friend_quiz_rooms SET status = 'ACTIVE', started_at = NOW() WHERE id = $1",
      [room.id]
    );
    await client.query("COMMIT");
    return getRoom(room.id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function startRound(roomId) {
  const room = await getRoom(roomId);
  if (!room || room.status !== "ACTIVE") throw new Error("FRIEND_QUIZ_NOT_ACTIVE");
  const usedResult = await getPool().query(
    "SELECT question_id FROM friend_quiz_answers WHERE room_id = $1",
    [roomId]
  );
  const excludedIds = usedResult.rows.map((row) => Number(row.question_id));
  const question = await quizRepository.getRandomQuestion({
    languageCode: room.language_code || "fa",
    excludedIds,
  });
  if (!question) throw new Error("NO_QUIZ_QUESTIONS");
  const options = [
    { original: "A", text: question.option_a },
    { original: "B", text: question.option_b },
    { original: "C", text: question.option_c },
    { original: "D", text: question.option_d },
  ].filter((option) => option.text !== null && option.text !== undefined && String(option.text).trim() !== "")
    .map((option) => ({ ...option, text: String(option.text) }));
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  const correctIndex = options.findIndex((option) => option.original === String(question.correct_option).toUpperCase());
  if (correctIndex < 0 || options.length < 2) throw new Error("INVALID_QUIZ_QUESTION");
  const snapshot = {
    questionText: question.question_text,
    options: options.map((option) => option.text),
    correctIndex,
  };
  const round = Number(room.current_round || 0) + 1;
  const expiresAt = new Date(Date.now() + ROUND_SECONDS * 1000);
  await getPool().query(
    `UPDATE friend_quiz_rooms
     SET current_round = $2, current_question_id = $3,
         question_snapshot = $4::JSONB, round_expires_at = $5
     WHERE id = $1 AND status = 'ACTIVE'`,
    [roomId, round, question.id, JSON.stringify(snapshot), expiresAt]
  );
  return { room: await getRoom(roomId), question, snapshot, expiresAt, round };
}

async function submitAnswer({ roomId, userId, round, optionIndex }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const roomResult = await client.query(
      "SELECT * FROM friend_quiz_rooms WHERE id = $1 FOR UPDATE",
      [roomId]
    );
    const room = roomResult.rows[0];
    if (!room || room.status !== "ACTIVE" || Number(room.current_round) !== Number(round)) {
      await client.query("ROLLBACK");
      return { accepted: false, reason: "ROUND_CLOSED" };
    }
    const playerResult = await client.query(
      "SELECT * FROM friend_quiz_players WHERE room_id = $1 AND user_id = $2 FOR UPDATE",
      [roomId, userId]
    );
    const player = playerResult.rows[0];
    if (!player) {
      await client.query("ROLLBACK");
      return { accepted: false, reason: "NOT_PLAYER" };
    }
    const already = await client.query(
      "SELECT id FROM friend_quiz_answers WHERE player_id = $1 AND round_number = $2",
      [player.id, round]
    );
    if (already.rows.length) {
      await client.query("ROLLBACK");
      return { accepted: false, reason: "ALREADY_ANSWERED" };
    }
    const snapshot = room.question_snapshot || {};
    if (!Number.isInteger(Number(optionIndex)) || Number(optionIndex) < 0 || Number(optionIndex) >= (snapshot.options || []).length) {
      await client.query("ROLLBACK");
      return { accepted: false, reason: "INVALID_OPTION" };
    }
    const correct = Number(optionIndex) === Number(snapshot.correctIndex);
    await client.query(
      `INSERT INTO friend_quiz_answers
       (room_id, player_id, question_id, round_number, selected_option, is_correct)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [roomId, player.id, room.current_question_id, round, String.fromCharCode(65 + Number(optionIndex)), correct]
    );
    await client.query(
      `UPDATE friend_quiz_players
       SET score = score + $2,
           correct_answers = correct_answers + $2,
           wrong_answers = wrong_answers + $3
       WHERE id = $1`,
      [player.id, correct ? 1 : 0, correct ? 0 : 1]
    );
    const countResult = await client.query(
      "SELECT COUNT(*)::INT AS count FROM friend_quiz_answers WHERE room_id = $1 AND round_number = $2",
      [roomId, round]
    );
    await client.query("COMMIT");
    return {
      accepted: true,
      correct,
      roundComplete: Number(countResult.rows[0].count) >= 2,
      roomId: Number(roomId),
      round: Number(round),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function closeRound(roomId, round) {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO friend_quiz_answers
       (room_id, player_id, question_id, round_number, selected_option, is_correct)
     SELECT $1, p.id, r.current_question_id, $2, NULL, FALSE
     FROM friend_quiz_players p
     JOIN friend_quiz_rooms r ON r.id = p.room_id
     WHERE p.room_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM friend_quiz_answers a
         WHERE a.player_id = p.id AND a.round_number = $2
       )
     ON CONFLICT (player_id, round_number) DO NOTHING
     RETURNING player_id`,
    [roomId, round]
  );
  if (result.rowCount) {
    await pool.query(
      `UPDATE friend_quiz_players p
       SET wrong_answers = wrong_answers + 1
       WHERE p.id = ANY($1::BIGINT[])`,
      [result.rows.map((row) => row.player_id)]
    );
  }
  const room = await getRoom(roomId);
  return room;
}

async function finishRoom(roomId) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const roomResult = await client.query(
      "SELECT * FROM friend_quiz_rooms WHERE id = $1 FOR UPDATE",
      [roomId]
    );
    const room = roomResult.rows[0];
    if (!room) throw new Error("FRIEND_QUIZ_NOT_FOUND");
    if (room.status === "COMPLETED") {
      await client.query("COMMIT");
      return getRoom(roomId);
    }
    const playersResult = await client.query(
      `SELECT p.*, u.telegram_user_id, u.display_name, u.username
       FROM friend_quiz_players p JOIN users u ON u.id = p.user_id
       WHERE p.room_id = $1 ORDER BY p.score DESC, p.player_number ASC FOR UPDATE OF p`,
      [roomId]
    );
    const players = playersResult.rows;
    if (players.length !== 2) throw new Error("FRIEND_QUIZ_PLAYERS_MISSING");
    const scoreA = Number(players[0].score);
    const scoreB = Number(players[1].score);
    let winner = null;
    let loser = null;
    if (scoreA !== scoreB) {
      winner = players[0];
      loser = players[1];
      const balanceBefore = await creditRepository.getAvailableBalance(winner.user_id, client);
      const account = await creditRepository.create({
        userId: winner.user_id,
        creditType: "STANDARD",
        amount: WINNER_REWARD,
        remainingAmount: WINNER_REWARD,
        source: "GAME_REWARD",
      }, client);
      await creditLedgerRepository.create({
        userId: winner.user_id,
        creditAccountId: account.id,
        entryType: "FRIEND_QUIZ_WIN",
        amount: WINNER_REWARD,
        balanceBefore,
        balanceAfter: Number(balanceBefore) + WINNER_REWARD,
        referenceType: "FRIEND_QUIZ",
        referenceId: roomId,
        description: "Friend quiz winner reward (+5 credits)",
      }, client);

      const accounts = await creditRepository.findAvailablePackages(loser.user_id, client);
      const balanceLoserBefore = accounts.reduce((sum, item) => sum + Number(item.remaining_amount), 0);
      let remaining = LOSER_PENALTY;
      for (const accountRow of accounts) {
        if (remaining <= 0) break;
        const available = Number(accountRow.remaining_amount);
        const deduction = Math.min(available, remaining);
        if (deduction <= 0) continue;
        const after = Number((available - deduction).toFixed(2));
        await creditRepository.updateRemaining(accountRow.id, after, client);
        await creditLedgerRepository.create({
          userId: loser.user_id,
          creditAccountId: accountRow.id,
          entryType: "FRIEND_QUIZ_LOSS",
          amount: -deduction,
          balanceBefore: available,
          balanceAfter: after,
          referenceType: "FRIEND_QUIZ",
          referenceId: roomId,
          description: "Friend quiz loser penalty (-3 credits)",
        }, client);
        remaining = Number((remaining - deduction).toFixed(2));
      }
      if (remaining > 0) {
        await client.query(
          `INSERT INTO debts
           (user_id, request_id, job_id, original_amount, multiplier, amount_due, amount_paid, status, source_type, source_id)
           VALUES ($1, NULL, NULL, $2, 1, $2, 0, 'ACTIVE', 'FRIEND_QUIZ', $3)`,
          [loser.user_id, remaining, roomId]
        );
      }
      await client.query(
        "UPDATE friend_quiz_rooms SET status = 'COMPLETED', completed_at = NOW(), result = $2::JSONB WHERE id = $1",
        [roomId, JSON.stringify({ winnerUserId: winner.user_id, loserUserId: loser.user_id, winnerScore: scoreA, loserScore: scoreB, reward: WINNER_REWARD, penalty: LOSER_PENALTY, debt: remaining })]
      );
    } else {
      await client.query(
        "UPDATE friend_quiz_rooms SET status = 'COMPLETED', completed_at = NOW(), result = $2::JSONB WHERE id = $1",
        [roomId, JSON.stringify({ draw: true, score: scoreA })]
      );
    }
    await client.query("COMMIT");
    return getRoom(roomId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cancelRoom(roomId, userId) {
  const result = await getPool().query(
    `UPDATE friend_quiz_rooms SET status = 'CANCELLED'
     WHERE id = $1 AND creator_user_id = $2 AND status = 'WAITING'
     RETURNING *`,
    [roomId, userId]
  );
  return result.rows[0] || null;
}

module.exports = {
  ROUND_SECONDS,
  TOTAL_ROUNDS,
  WINNER_REWARD,
  LOSER_PENALTY,
  createRoom,
  getRoom,
  getRoomByCode,
  joinRoom,
  startRound,
  submitAnswer,
  closeRound,
  finishRoom,
  cancelRoom,
};
