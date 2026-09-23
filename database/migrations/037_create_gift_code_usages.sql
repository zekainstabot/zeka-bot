CREATE TABLE IF NOT EXISTS gift_code_usages (
    id BIGSERIAL PRIMARY KEY,

    gift_code_id BIGINT NOT NULL
        REFERENCES gift_codes(id)
        ON DELETE CASCADE,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reward_id BIGINT REFERENCES rewards(id)
        ON DELETE SET NULL,

    used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    metadata JSONB,

    UNIQUE (gift_code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gift_code_usages_gift_code_id
    ON gift_code_usages(gift_code_id);

CREATE INDEX IF NOT EXISTS idx_gift_code_usages_user_id
    ON gift_code_usages(user_id);

CREATE INDEX IF NOT EXISTS idx_gift_code_usages_reward_id
    ON gift_code_usages(reward_id);

CREATE INDEX IF NOT EXISTS idx_gift_code_usages_used_at
    ON gift_code_usages(used_at);

CREATE INDEX IF NOT EXISTS idx_gift_code_usages_user_used
    ON gift_code_usages(user_id, used_at);
