-- A player's quiz credit_reward is the net total across all rounds.
-- It can therefore be lower than -0.25 when multiple answers are wrong or unanswered.
ALTER TABLE game_session_players
  DROP CONSTRAINT IF EXISTS game_session_players_reward_check;

ALTER TABLE game_session_players
  ADD CONSTRAINT game_session_players_reward_check
  CHECK (credit_reward >= -1000000);
