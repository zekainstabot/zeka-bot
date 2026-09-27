CREATE TABLE IF NOT EXISTS game_types (
    id BIGSERIAL PRIMARY KEY,
    game_key VARCHAR(50) NOT NULL UNIQUE,
    title_key VARCHAR(150) NOT NULL,
    description_key VARCHAR(200),
    game_type VARCHAR(30) NOT NULL DEFAULT 'CASUAL',
    entry_cost NUMERIC(12,2) NOT NULL DEFAULT 1.00,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    config JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT game_types_entry_cost_check CHECK (entry_cost >= 0)
);

CREATE TABLE IF NOT EXISTS game_settings (
    id BIGSERIAL PRIMARY KEY,
    game_type_id BIGINT REFERENCES game_types(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT game_settings_unique_key UNIQUE (game_type_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_game_settings_game_type
    ON game_settings(game_type_id);

CREATE TABLE IF NOT EXISTS wheel_segments (
    id BIGSERIAL PRIMARY KEY,
    game_type_id BIGINT NOT NULL REFERENCES game_types(id) ON DELETE CASCADE,
    segment_number INTEGER NOT NULL,
    title_key VARCHAR(150) NOT NULL,
    result_type VARCHAR(30) NOT NULL,
    credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    xp_amount INTEGER NOT NULL DEFAULT 0,
    pro_days INTEGER NOT NULL DEFAULT 0,
    probability NUMERIC(8,5) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    config JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT wheel_segments_unique_number
        UNIQUE (game_type_id, segment_number),

    CONSTRAINT wheel_segments_number_check
        CHECK (segment_number > 0),

    CONSTRAINT wheel_segments_probability_check
        CHECK (probability >= 0),

    CONSTRAINT wheel_segments_credit_check
        CHECK (credit_amount >= 0),

    CONSTRAINT wheel_segments_xp_check
        CHECK (xp_amount >= 0),

    CONSTRAINT wheel_segments_pro_days_check
        CHECK (pro_days >= 0)
);

CREATE INDEX IF NOT EXISTS idx_wheel_segments_game_type
    ON wheel_segments(game_type_id);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id BIGSERIAL PRIMARY KEY,

    language_code VARCHAR(10) NOT NULL DEFAULT 'fa',

    category VARCHAR(50) NOT NULL,

    difficulty VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',

    question_text TEXT NOT NULL,

    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,

    correct_option CHAR(1) NOT NULL,

    explanation TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    source_type VARCHAR(30) NOT NULL DEFAULT 'ADMIN',

    source_id BIGINT,

    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    updated_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT quiz_questions_correct_option_check
        CHECK (correct_option IN ('A', 'B', 'C', 'D'))
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_lookup
    ON quiz_questions(
        language_code,
        category,
        difficulty,
        status
    );

CREATE INDEX IF NOT EXISTS idx_quiz_questions_status
    ON quiz_questions(status);

CREATE TABLE IF NOT EXISTS quiz_question_submissions (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    question_text TEXT NOT NULL,

    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,

    correct_option CHAR(1) NOT NULL,

    category VARCHAR(50) NOT NULL,

    difficulty VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',

    language_code VARCHAR(10) NOT NULL DEFAULT 'fa',

    explanation TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    reviewed_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    reviewed_at TIMESTAMPTZ,

    approved_question_id BIGINT
        REFERENCES quiz_questions(id)
        ON DELETE SET NULL,

    reward_credit NUMERIC(12,2) NOT NULL DEFAULT 5.00,

    reward_xp INTEGER NOT NULL DEFAULT 0,

    reward_granted_at TIMESTAMPTZ,

    rejection_reason TEXT,

    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT quiz_submissions_correct_option_check
        CHECK (correct_option IN ('A', 'B', 'C', 'D')),

    CONSTRAINT quiz_submissions_reward_credit_check
        CHECK (reward_credit >= 0),

    CONSTRAINT quiz_submissions_reward_xp_check
        CHECK (reward_xp >= 0)
);

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_user
    ON quiz_question_submissions(user_id);

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_status
    ON quiz_question_submissions(status);

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_created
    ON quiz_question_submissions(created_at);

CREATE TABLE IF NOT EXISTS game_sessions (
    id BIGSERIAL PRIMARY KEY,

    session_key VARCHAR(64) NOT NULL UNIQUE,

    game_type_id BIGINT NOT NULL
        REFERENCES game_types(id)
        ON DELETE RESTRICT,

    user_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'WAITING',

    entry_cost NUMERIC(12,2) NOT NULL DEFAULT 1.00,

    reserved_cost NUMERIC(12,2) NOT NULL DEFAULT 0,

    current_round INTEGER NOT NULL DEFAULT 0,

    total_rounds INTEGER NOT NULL DEFAULT 1,

    winner_user_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    result JSONB NOT NULL DEFAULT '{}'::JSONB,

    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT game_sessions_entry_cost_check
        CHECK (entry_cost >= 0),

    CONSTRAINT game_sessions_reserved_cost_check
        CHECK (reserved_cost >= 0),

    CONSTRAINT game_sessions_round_check
        CHECK (
            current_round >= 0
            AND total_rounds > 0
        )
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_user_status
    ON game_sessions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_game_sessions_game_status
    ON game_sessions(game_type_id, status);

CREATE INDEX IF NOT EXISTS idx_game_sessions_expires
    ON game_sessions(expires_at);

CREATE TABLE IF NOT EXISTS game_session_players (
    id BIGSERIAL PRIMARY KEY,

    session_id BIGINT NOT NULL
        REFERENCES game_sessions(id)
        ON DELETE CASCADE,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    player_number INTEGER NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    reserved_cost NUMERIC(12,2) NOT NULL DEFAULT 0,

    score NUMERIC(12,2) NOT NULL DEFAULT 0,

    xp_earned INTEGER NOT NULL DEFAULT 0,

    credit_reward NUMERIC(12,2) NOT NULL DEFAULT 0,

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    completed_at TIMESTAMPTZ,

    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

    CONSTRAINT game_session_players_unique_user
        UNIQUE (session_id, user_id),

    CONSTRAINT game_session_players_unique_number
        UNIQUE (session_id, player_number),

    CONSTRAINT game_session_players_number_check
        CHECK (player_number > 0),

    CONSTRAINT game_session_players_reserved_check
        CHECK (reserved_cost >= 0),

    CONSTRAINT game_session_players_xp_check
        CHECK (xp_earned >= 0),

    CONSTRAINT game_session_players_reward_check
        CHECK (credit_reward >= 0)
);

CREATE INDEX IF NOT EXISTS idx_game_session_players_user
    ON game_session_players(user_id);

CREATE INDEX IF NOT EXISTS idx_game_session_players_session
    ON game_session_players(session_id);

CREATE TABLE IF NOT EXISTS game_answers (
    id BIGSERIAL PRIMARY KEY,

    session_id BIGINT NOT NULL
        REFERENCES game_sessions(id)
        ON DELETE CASCADE,

    player_id BIGINT NOT NULL
        REFERENCES game_session_players(id)
        ON DELETE CASCADE,

    question_id BIGINT
        REFERENCES quiz_questions(id)
        ON DELETE SET NULL,

    round_number INTEGER NOT NULL,

    selected_option CHAR(1),

    is_correct BOOLEAN,

    response_time_ms INTEGER,

    credit_reward NUMERIC(12,2) NOT NULL DEFAULT 0,

    xp_reward INTEGER NOT NULL DEFAULT 0,

    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

    answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT game_answers_round_check
        CHECK (round_number > 0),

    CONSTRAINT game_answers_selected_option_check
        CHECK (
            selected_option IS NULL
            OR selected_option IN ('A', 'B', 'C', 'D')
        ),

    CONSTRAINT game_answers_response_time_check
        CHECK (
            response_time_ms IS NULL
            OR response_time_ms >= 0
        ),

    CONSTRAINT game_answers_credit_reward_check
        CHECK (credit_reward >= 0),

    CONSTRAINT game_answers_xp_reward_check
        CHECK (xp_reward >= 0),

    CONSTRAINT game_answers_unique_round
        UNIQUE (player_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_game_answers_session
    ON game_answers(session_id);

CREATE INDEX IF NOT EXISTS idx_game_answers_player
    ON game_answers(player_id);

CREATE INDEX IF NOT EXISTS idx_game_answers_question
    ON game_answers(question_id);


INSERT INTO game_types (
    game_key,
    title_key,
    description_key,
    game_type,
    entry_cost,
    status,
    config
)
VALUES
(
    'wheel_of_fortune',
    'games.wheel.title',
    'games.wheel.description',
    'CASUAL',
    1.00,
    'ACTIVE',
    '{"segments":8}'::JSONB
),
(
    'quiz_guess',
    'games.quiz_guess.title',
    'games.quiz_guess.description',
    'QUIZ',
    1.00,
    'ACTIVE',
    '{}'::JSONB
),
(
    'quiz_general',
    'games.quiz_general.title',
    'games.quiz_general.description',
    'QUIZ',
    1.00,
    'ACTIVE',
    '{}'::JSONB
),
(
    'quiz_daily',
    'games.quiz_daily.title',
    'games.quiz_daily.description',
    'QUIZ',
    1.00,
    'ACTIVE',
    '{}'::JSONB
),
(
    'quiz_multi',
    'games.quiz_multi.title',
    'games.quiz_multi.description',
    'QUIZ',
    1.00,
    'ACTIVE',
    '{"question_count":10}'::JSONB
),
(
    'quiz_friend',
    'games.quiz_friend.title',
    'games.quiz_friend.description',
    'MATCH',
    1.00,
    'ACTIVE',
    '{}'::JSONB
),
(
    'quiz_random',
    'games.quiz_random.title',
    'games.quiz_random.description',
    'MATCH',
    1.00,
    'ACTIVE',
    '{}'::JSONB
)
ON CONFLICT (game_key) DO NOTHING;


INSERT INTO wheel_segments (
    game_type_id,
    segment_number,
    title_key,
    result_type,
    credit_amount,
    xp_amount,
    probability
)
SELECT
    g.id,
    s.segment_number,
    s.title_key,
    s.result_type,
    s.credit_amount,
    s.xp_amount,
    s.probability
FROM game_types g
CROSS JOIN (
    VALUES
        (
            1,
            'games.wheel.blank',
            'BLANK',
            0.00,
            0,
            20.00000
        ),
        (
            2,
            'games.wheel.blank',
            'BLANK',
            0.00,
            0,
            20.00000
        ),
        (
            3,
            'games.wheel.blank',
            'BLANK',
            0.00,
            0,
            20.00000
        ),
        (
            4,
            'games.wheel.credit_half',
            'CREDIT',
            0.50,
            0,
            20.00000
        ),
        (
            5,
            'games.wheel.credit_one',
            'CREDIT',
            1.00,
            0,
            12.00000
        ),
        (
            6,
            'games.wheel.credit_two',
            'CREDIT',
            2.00,
            0,
            5.00000
        ),
        (
            7,
            'games.wheel.xp_five',
            'XP',
            0.00,
            5,
            2.50000
        ),
        (
            8,
            'games.wheel.credit_five',
            'CREDIT',
            5.00,
            0,
            0.50000
        )
) AS s(
    segment_number,
    title_key,
    result_type,
    credit_amount,
    xp_amount,
    probability
)
WHERE g.game_key = 'wheel_of_fortune'
ON CONFLICT (
    game_type_id,
    segment_number
) DO NOTHING;


INSERT INTO game_settings (
    game_type_id,
    setting_key,
    setting_value,
    description
)
SELECT
    g.id,
    s.setting_key,
    s.setting_value,
    s.description
FROM game_types g
CROSS JOIN (
    VALUES
        (
            'cost',
            '{"credit":1.00}'::JSONB,
            'هزینه هر بار بازی'
        ),
        (
            'enabled',
            'true'::JSONB,
            'فعال بودن بازی'
        ),
        (
            'question_submission_reward',
            '{"credit":5.00,"xp":0}'::JSONB,
            'پاداش سؤال تأییدشده'
        ),
        (
            'quiz_question_count',
            '{"count":10}'::JSONB,
            'تعداد سؤال مسابقه چندمرحله‌ای'
        )
) AS s(
    setting_key,
    setting_value,
    description
)
WHERE g.game_key IN (
    'wheel_of_fortune',
    'quiz_guess',
    'quiz_general',
    'quiz_daily',
    'quiz_multi',
    'quiz_friend',
    'quiz_random'
)
ON CONFLICT (
    game_type_id,
    setting_key
) DO NOTHING;
