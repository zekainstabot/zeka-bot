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
    category_id BIGINT NOT NULL REFERENCES fortune_categories(id) ON DELETE CASCADE,
    title TEXT,
    content TEXT NOT NULL,
    title_en TEXT,
    content_en TEXT,
    source_url TEXT,
    source_number INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_by BIGINT,
    updated_by BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fortunes ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE fortunes ADD COLUMN IF NOT EXISTS content_en TEXT;

CREATE INDEX IF NOT EXISTS idx_fortunes_category_id ON fortunes(category_id);
CREATE INDEX IF NOT EXISTS idx_fortunes_status ON fortunes(status);
CREATE INDEX IF NOT EXISTS idx_fortunes_category_status ON fortunes(category_id, status);
CREATE INDEX IF NOT EXISTS idx_fortunes_source_url ON fortunes(source_url);

INSERT INTO fortune_categories (name_fa, slug)
VALUES
    ('فال حافظ', 'hafez'),
    ('فال عشق', 'love'),
    ('فال روزانه', 'daily'),
    ('فال مالی', 'money'),
    ('فال نیت', 'intention')
ON CONFLICT (slug) DO UPDATE
SET name_fa = EXCLUDED.name_fa,
    updated_at = NOW();

INSERT INTO admin_permissions (permission_key, permission_name, description)
VALUES (
    'features.fortune.manage',
    'مدیریت فال',
    'افزودن، ویرایش و مدیریت محتوای فال'
)
ON CONFLICT (permission_key) DO NOTHING;
