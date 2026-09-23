CREATE TABLE IF NOT EXISTS referrals (
    id BIGSERIAL PRIMARY KEY,

    referrer_user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    referred_user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    referral_code VARCHAR(50) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    reward_granted BOOLEAN NOT NULL DEFAULT FALSE,

    reward_credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    reward_xp INTEGER NOT NULL DEFAULT 0,

    pro_reward_granted BOOLEAN NOT NULL DEFAULT FALSE,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (referred_user_id),

    UNIQUE (referrer_user_id, referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id
    ON referrals(referrer_user_id);

CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id
    ON referrals(referred_user_id);

CREATE INDEX IF NOT EXISTS idx_referrals_code
    ON referrals(referral_code);

CREATE INDEX IF NOT EXISTS idx_referrals_status
    ON referrals(status);

CREATE INDEX IF NOT EXISTS idx_referrals_completed_at
    ON referrals(completed_at);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status
    ON referrals(referrer_user_id, status);
