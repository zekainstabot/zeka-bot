-- Remove known semantic duplicates left by legacy quiz seeds and clarify ambiguous wording.
UPDATE quiz_questions
SET status = 'INACTIVE',
    updated_at = NOW()
WHERE language_code = 'fa'
  AND status = 'ACTIVE'
  AND source_type IS DISTINCT FROM 'CURATED'
  AND question_text IN (
    'بزرگ‌ترین سیاره منظومه شمسی کدام است؟',
    'کدام اندام بدن انسان خون را پمپاژ می‌کند؟',
    'بزرگ‌ترین اقیانوس جهان کدام است؟',
    'کدام کشور به شکل یک شبه‌جزیره بزرگ در جنوب اروپا قرار دارد؟'
  );

UPDATE quiz_questions
SET question_text = 'استوانه کوروش در کدام شهر باستانی کشف شد؟',
    explanation = 'استوانه گلی کوروش در شهر باستانی بابل به دست آمده است.',
    updated_at = NOW()
WHERE language_code = 'fa'
  AND source_type = 'CURATED'
  AND status = 'ACTIVE'
  AND question_text = 'فرمان مشهور منشور حقوق شهروندی کوروش به کدام شهر باستانی مربوط است؟';

UPDATE quiz_questions
SET question_text = 'واحد رایج برای بیان اندازه فایل‌های دیجیتال کدام است؟',
    explanation = 'بایت یکی از واحدهای رایج برای بیان اندازه فایل‌ها و داده‌های دیجیتال است.',
    updated_at = NOW()
WHERE language_code = 'fa'
  AND source_type = 'CURATED'
  AND status = 'ACTIVE'
  AND question_text = 'واحد اصلی اندازه‌گیری اطلاعات دیجیتال چیست؟';

-- Keep category IDs aligned for all curated and legacy questions.
UPDATE quiz_questions q
SET category_id = c.id
FROM quiz_categories c
WHERE q.category = c.slug
  AND q.category_id IS DISTINCT FROM c.id;
