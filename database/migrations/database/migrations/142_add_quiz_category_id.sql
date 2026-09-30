ALTER TABLE quiz_questions
ADD COLUMN IF NOT EXISTS category_id INTEGER
REFERENCES quiz_categories(id)
ON DELETE SET NULL;

UPDATE quiz_questions
SET category_id = qc.id
FROM quiz_categories qc
WHERE quiz_questions.category = qc.slug;

INSERT INTO quiz_categories
(name_fa, name_en, slug)
VALUES
('عمومی', 'General', 'general')
ON CONFLICT (slug) DO NOTHING;

UPDATE quiz_questions
SET category_id = qc.id
FROM quiz_categories qc
WHERE quiz_questions.category = qc.slug;

CREATE INDEX IF NOT EXISTS idx_quiz_questions_category_id
ON quiz_questions(category_id);
