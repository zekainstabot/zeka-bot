CREATE TABLE IF NOT EXISTS feedback (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    request_id BIGINT REFERENCES requests(id) ON DELETE SET NULL,
    job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,

    platform VARCHAR(30),

    rating INTEGER,

    feedback_type VARCHAR(30) NOT NULL DEFAULT 'GENERAL',

    message TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id
    ON feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_request_id
    ON feedback(request_id);

CREATE INDEX IF NOT EXISTS idx_feedback_job_id
    ON feedback(job_id);

CREATE INDEX IF NOT EXISTS idx_feedback_platform
    ON feedback(platform);

CREATE INDEX IF NOT EXISTS idx_feedback_type
    ON feedback(feedback_type);

CREATE INDEX IF NOT EXISTS idx_feedback_rating
    ON feedback(rating);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at
    ON feedback(created_at);
