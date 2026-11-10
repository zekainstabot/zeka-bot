-- Incorrect and unanswered quiz answers may carry a negative credit adjustment.
-- The application records the actual deducted amount (up to 0.25 credit) in credit_reward.
ALTER TABLE game_answers
  DROP CONSTRAINT IF EXISTS game_answers_credit_reward_check;

ALTER TABLE game_answers
  ADD CONSTRAINT game_answers_credit_reward_check
  CHECK (credit_reward >= -0.25);
