CREATE TABLE IF NOT EXISTS quiz_categories (
    id SERIAL PRIMARY KEY,

    name_fa VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),

    slug VARCHAR(100) UNIQUE NOT NULL,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);


INSERT INTO quiz_categories
(name_fa, name_en, slug)
VALUES
('جغرافیا', 'Geography', 'geography'),
('تاریخ', 'History', 'history'),
('علم', 'Science', 'science'),
('ورزش', 'Sports', 'sports')
ON CONFLICT (slug) DO NOTHING;
