CREATE TABLE IF NOT EXISTS leaderboard_entries (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    leaderboard_type VARCHAR(30) NOT NULL,

    score NUMERIC(18,2) NOT NULL DEFAULT 0,

    rank INTEGER,

    period_start DATE,

    period_end DATE,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        user_id,
        leaderboard_type,
        period_start,
        period_end
    )
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_user_id
    ON leaderboard_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_type
    ON leaderboard_entries(leaderboard_type);

CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_score
    ON leaderboard_entries(leaderboard_type, score DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_rank
    ON leaderboard_entries(leaderboard_type, rank);

CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_period
    ON leaderboard_entries(
        leaderboard_type,
        period_start,
        period_end
    );

CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_user_type
    ON leaderboard_entries(user_id, leaderboard_type);
