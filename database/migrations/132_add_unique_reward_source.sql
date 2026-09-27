CREATE UNIQUE INDEX IF NOT EXISTS idx_rewards_unique_source
    ON rewards (
        user_id,
        source_type,
        source_id,
        reward_type
    )
    WHERE source_type IS NOT NULL
      AND source_id IS NOT NULL;
