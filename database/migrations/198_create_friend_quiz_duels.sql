ALTER TABLE debts
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS source_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_debts_source
  ON debts(source_type, source_id);

CREATE TABLE IF NOT EXISTS friend_quiz_rooms (
  id BIGSERIAL PRIMARY KEY,
  invite_code VARCHAR(24) NOT NULL UNIQUE,
  mode VARCHAR(12) NOT NULL CHECK (mode IN ('DM', 'GROUP')),
  creator_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_chat_id BIGINT,
  status VARCHAR(16) NOT NULL DEFAULT 'WAITING'
    CHECK (status IN ('WAITING', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  language_code VARCHAR(2) NOT NULL DEFAULT 'fa'
    CHECK (language_code IN ('fa', 'en')),
  current_round INTEGER NOT NULL DEFAULT 0 CHECK (current_round >= 0),
  total_rounds INTEGER NOT NULL DEFAULT 5 CHECK (total_rounds BETWEEN 1 AND 20),
  current_question_id BIGINT REFERENCES quiz_questions(id) ON DELETE SET NULL,
  question_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  round_expires_at TIMESTAMPTZ,
  result JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_friend_quiz_rooms_status
  ON friend_quiz_rooms(status, created_at);

CREATE TABLE IF NOT EXISTS friend_quiz_players (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES friend_quiz_rooms(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_number SMALLINT NOT NULL CHECK (player_number IN (1, 2)),
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
  correct_answers INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  wrong_answers INTEGER NOT NULL DEFAULT 0 CHECK (wrong_answers >= 0),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id),
  UNIQUE(room_id, player_number)
);

CREATE TABLE IF NOT EXISTS friend_quiz_answers (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES friend_quiz_rooms(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES friend_quiz_players(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES quiz_questions(id) ON DELETE RESTRICT,
  round_number INTEGER NOT NULL CHECK (round_number > 0),
  selected_option VARCHAR(1),
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_friend_quiz_answers_room_round
  ON friend_quiz_answers(room_id, round_number);
