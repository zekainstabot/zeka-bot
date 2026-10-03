CREATE TABLE IF NOT EXISTS fortune_categories (
    id BIGSERIAL PRIMARY KEY,
    name_fa VARCHAR(150) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fortunes (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL
        REFERENCES fortune_categories(id)
        ON DELETE CASCADE,

    title TEXT,
    content TEXT NOT NULL,

    source_url TEXT,
    source_number INTEGER,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_by BIGINT,
    updated_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fortunes_status_check
        CHECK (
            status IN ('ACTIVE', 'INACTIVE')
        )
);

CREATE INDEX IF NOT EXISTS idx_fortunes_category_id
    ON fortunes(category_id);

CREATE INDEX IF NOT EXISTS idx_fortunes_status
    ON fortunes(status);

CREATE INDEX IF NOT EXISTS idx_fortunes_category_status
    ON fortunes(category_id, status);

CREATE INDEX IF NOT EXISTS idx_fortunes_source_url
    ON fortunes(source_url);

INSERT INTO fortune_categories (
    name_fa,
    slug
)
VALUES
    ('فال حافظ', 'hafez'),
    ('فال عشق', 'love'),
    ('فال روزانه', 'daily'),
    ('فال مالی', 'money'),
    ('فال نیت', 'intention')
ON CONFLICT (slug) DO NOTHING;
