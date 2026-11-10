-- Normalize the complete built-in Persian quiz bank.
-- Keep every question and answer; only deactivate known legacy duplicates.
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

WITH bank(question_text, category, difficulty) AS (
  VALUES
    ('پایتخت ایران کدام شهر است؟','general','EASY'),
    ('آب در فشار استاندارد در چند درجه سانتی‌گراد می‌جوشد؟','science','EASY'),
    ('کدام گاز بیشترین سهم را در جو زمین دارد؟','science','EASY'),
    ('یک سال معمولی چند روز دارد؟','general','EASY'),
    ('کدام یک از موارد زیر یک فلز است؟','science','EASY'),
    ('بزرگ‌ترین قاره جهان از نظر مساحت کدام است؟','geography','EASY'),
    ('کدام تنگه دریای مدیترانه را به اقیانوس اطلس وصل می‌کند؟','geography','MEDIUM'),
    ('کشور لسوتو به‌طور کامل درون کدام کشور قرار گرفته است؟','geography','HARD'),
    ('تخت جمشید در زمان کدام دودمان ساخته شد؟','history','EASY'),
    ('استوانه کوروش در کدام شهر باستانی کشف شد؟','history','MEDIUM'),
    ('نبرد ماراتون میان یونانیان و کدام امپراتوری رخ داد؟','history','HARD'),
    ('کدام سیاره به سیاره سرخ معروف است؟','science','EASY'),
    ('نماد شیمیایی عنصر سدیم چیست؟','science','MEDIUM'),
    ('کدام ذره زیر بار الکتریکی منفی دارد؟','science','EASY'),
    ('در فوتبال، هر تیم در آغاز مسابقه چند بازیکن داخل زمین دارد؟','sports','EASY'),
    ('مسابقه تنیس گرند اسلم ویمبلدون روی چه نوع زمینی برگزار می‌شود؟','sports','MEDIUM'),
    ('در بازی شطرنج، کدام مهره می‌تواند از روی مهره‌های دیگر بپرد؟','sports','EASY'),
    ('سراینده شاهنامه کیست؟','literature','EASY'),
    ('کتاب گلستان اثر کدام نویسنده ایرانی است؟','literature','MEDIUM'),
    ('رمان «دن کیشوت» را چه کسی نوشته است؟','literature','HARD'),
    ('کدام هنر با دوربین و ثبت تصویر سروکار دارد؟','art','EASY'),
    ('تابلوی مونالیزا اثر کدام هنرمند است؟','art','EASY'),
    ('سبک هنری امپرسیونیسم ابتدا در کدام کشور شکل گرفت؟','art','MEDIUM'),
    ('کتاب مقدس مسلمانان چه نام دارد؟','religion','EASY'),
    ('ماه رمضان در تقویم هجری قمری، ماه چندم است؟','religion','EASY'),
    ('در متون اسلامی، لقب «ذوالنون» به کدام پیامبر اشاره دارد؟','religion','HARD'),
    ('نوروز با آغاز کدام فصل همراه است؟','culture','EASY'),
    ('ساز سنتی تار در کدام خانواده سازها قرار می‌گیرد؟','culture','MEDIUM'),
    ('خط میخی در کدام تمدن باستانی میان‌رودان از نخستین نمونه‌های آن پدید آمد؟','culture','HARD'),
    ('واحد رایج برای بیان اندازه فایل‌های دیجیتال کدام است؟','technology','MEDIUM'),
    ('کدام پروتکل معمولاً برای انتقال امن صفحات وب استفاده می‌شود؟','technology','MEDIUM'),
    ('در نشانی IPv4 چند بیت برای نمایش آدرس استفاده می‌شود؟','technology','HARD'),
    ('در یک شبانه‌روز کامل چند ساعت وجود دارد؟','general','EASY'),
    ('عدد رومی X چه مقداری دارد؟','general','EASY'),
    ('مجموع زاویه‌های داخلی یک شش‌ضلعی ساده چند درجه است؟','general','MEDIUM'),
    ('پایتخت فرانسه کدام شهر است؟','geography','EASY'),
    ('بزرگ‌ترین سیاره منظومه شمسی کدام است؟','science','EASY'),
    ('بلندترین قله جهان نسبت به سطح متوسط دریا چه نام دارد؟','geography','EASY'),
    ('بزرگ‌ترین اقیانوس زمین کدام است؟','geography','EASY'),
    ('کدام اندام با انقباض منظم، خون را در بدن به گردش درمی‌آورد؟','science','EASY'),
    ('نماد شیمیایی طلا کدام است؟','science','MEDIUM'),
    ('کدام کشور در نقشه اروپا به شکل چکمه دیده می‌شود؟','geography','EASY'),
    ('زبان رسمی کشور برزیل چیست؟','culture','MEDIUM'),
    ('بزرگ‌ترین پستاندار زنده جهان کدام جانور است؟','science','EASY'),
    ('پایتخت مصر کدام شهر است؟','geography','EASY'),
    ('بزرگ‌ترین بیابان گرم جهان کدام است؟','geography','MEDIUM'),
    ('نظریه نسبیت با نام کدام فیزیک‌دان پیوند خورده است؟','science','MEDIUM'),
    ('شهر باستانی پترا در کدام کشور امروزی قرار دارد؟','history','MEDIUM'),
    ('فراوان‌ترین عنصر در جهان شناخته‌شده کدام است؟','science','MEDIUM'),
    ('لقب «سرزمین هزار دریاچه» بیشتر برای کدام کشور به کار می‌رود؟','geography','MEDIUM'),
    ('کدام اقیانوس میان شرق آفریقا، جنوب آسیا و غرب استرالیا گسترده شده است؟','geography','EASY'),
    ('کدام شهر ایتالیا به شبکه کانال‌های آبی خود شهرت دارد؟','geography','EASY'),
    ('تمدن مایا در کدام بخش جهان باستان شکوفا شد؟','history','MEDIUM'),
    ('پایتخت کشور کانادا کدام شهر است؟','geography','EASY'),
    ('کدام فلز در دمای معمول اتاق به حالت مایع است؟','science','HARD'),
    ('شهر ماچوپیچو یادگار کدام تمدن پیشاکلمبی است؟','history','MEDIUM'),
    ('بزرگ‌ترین جزیره جهان که کشور مستقل نیست کدام است؟','geography','MEDIUM'),
    ('کدام سیاره برای یک دور کامل گردش به دور خورشید بیشترین زمان را نیاز دارد؟','science','HARD'),
    ('قوانین مشهور حرکت سیارات بر پایه داده‌های رصدی را چه کسی تدوین کرد؟','science','HARD'),
    ('پایتخت مجارستان کدام شهر است؟','geography','EASY'),
    ('زیگورات‌ها از بناهای شاخص کدام منطقه تمدنی باستان بودند؟','history','HARD'),
    ('کدام بخش مغز نقش مهمی در هماهنگی حرکات و حفظ تعادل دارد؟','science','HARD'),
    ('گیاهان در فتوسنتز کدام گاز را از هوا جذب می‌کنند؟','science','MEDIUM'),
    ('مجموعه تاریخی آنگکور وات در کدام کشور قرار دارد؟','history','HARD'),
    ('عدد اتمی عنصر کربن چند است؟','science','MEDIUM')
)
UPDATE quiz_questions q
SET category = bank.category,
    difficulty = bank.difficulty,
    category_id = c.id,
    updated_at = NOW()
FROM bank
JOIN quiz_categories c ON c.slug = bank.category
WHERE q.language_code = 'fa'
  AND q.status = 'ACTIVE'
  AND q.question_text = bank.question_text
  AND (
    q.category IS DISTINCT FROM bank.category
    OR q.difficulty IS DISTINCT FROM bank.difficulty
    OR q.category_id IS DISTINCT FROM c.id
  );

-- Retain one active copy of each exactly normalized question per language.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY language_code,
             LOWER(REGEXP_REPLACE(BTRIM(question_text), '[[:space:][:punct:]]+', '', 'g'))
           ORDER BY
             CASE WHEN source_type = 'CURATED' THEN 0 ELSE 1 END,
             id
         ) AS duplicate_rank
  FROM quiz_questions
  WHERE status = 'ACTIVE'
)
UPDATE quiz_questions q
SET status = 'INACTIVE',
    updated_at = NOW()
FROM ranked r
WHERE q.id = r.id
  AND r.duplicate_rank > 1;

-- Ensure all active questions have a matching category foreign key.
UPDATE quiz_questions q
SET category_id = c.id,
    updated_at = NOW()
FROM quiz_categories c
WHERE q.category = c.slug
  AND q.category_id IS DISTINCT FROM c.id;

CREATE INDEX IF NOT EXISTS idx_quiz_questions_active_language_difficulty
ON quiz_questions (language_code, difficulty)
WHERE status = 'ACTIVE';
