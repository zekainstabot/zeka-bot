ALTER TABLE credit_reservations
ADD COLUMN IF NOT EXISTS game_session_id BIGINT
REFERENCES game_sessions(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_credit_reservations_game_session_id
    ON credit_reservations(game_session_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_reservations_active_game_session
    ON credit_reservations(game_session_id)
    WHERE game_session_id IS NOT NULL
      AND status = 'RESERVED';
