CREATE TABLE IF NOT EXISTS changelog (
    id BIGSERIAL PRIMARY KEY,

    version VARCHAR(30) NOT NULL,

    title VARCHAR(200) NOT NULL,

    description TEXT,

    change_type VARCHAR(30) NOT NULL DEFAULT 'UPDATE',

    is_public BOOLEAN NOT NULL DEFAULT TRUE,

    published_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_changelog_version
    ON changelog(version);

CREATE INDEX IF NOT EXISTS idx_changelog_change_type
    ON changelog(change_type);

CREATE INDEX IF NOT EXISTS idx_changelog_public
    ON changelog(is_public);

CREATE INDEX IF NOT EXISTS idx_changelog_published_at
    ON changelog(published_at);

CREATE INDEX IF NOT EXISTS idx_changelog_created_at
    ON changelog(created_at);
