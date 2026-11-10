-- Curated replacement question bank. All questions are newly worded and reviewed for a single defensible answer.
INSERT INTO quiz_categories (slug, name_fa, name_en)
VALUES
('geography','جغرافیا','Geography'),
('history','تاریخ','History'),
('science','علوم','Science'),
('sports','ورزش','Sports'),
('literature','ادبیات و زبان','Literature'),
('art','هنر و سینما','Art'),
('religion','دین و معارف','Religion'),
('culture','فرهنگ و ایران‌شناسی','Culture'),
('technology','فناوری','Technology'),
('general','دانستنی‌های عمومی','General')
ON CONFLICT (slug) DO UPDATE
SET name_fa = EXCLUDED.name_fa,
    name_en = EXCLUDED.name_en,
    updated_at = NOW();

UPDATE quiz_questions
SET status = 'INACTIVE',
    updated_at = NOW()
WHERE language_code = 'fa'
  AND (
    question_text ILIKE '%باهوش‌ترین حیوان%'
    OR question_text ILIKE '%آب نارگیل%پلاسما%'
    OR question_text ILIKE '%شکلات%سگ%'
    OR question_text ILIKE '%کلسیم شیر%'
    OR question_text ILIKE '%اولین عامل کوری%'
    OR question_text ILIKE '%تعداد گروه‌های خونی%'
    OR question_text ILIKE '%تخت جمشید%بزرگ‌ترین%'
  );

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

INSERT INTO quiz_questions (
  language_code, category, difficulty, question_text,
  option_a, option_b, option_c, option_d,
  correct_option, explanation, status, source_type
)
VALUES
  ('fa','geography','EASY','بزرگ‌ترین قاره جهان از نظر مساحت کدام است؟','آفریقا','آسیا','اروپا','آمریکای جنوبی','B','آسیا بزرگ‌ترین قاره از نظر مساحت است.','ACTIVE','CURATED'),
  ('fa','geography','MEDIUM','کدام تنگه دریای مدیترانه را به اقیانوس اطلس وصل می‌کند؟','بسفر','هرمز','جبل‌الطارق','باب‌المندب','C','تنگه جبل‌الطارق میان اسپانیا و مراکش قرار دارد.','ACTIVE','CURATED'),
  ('fa','geography','HARD','کشور لسوتو به‌طور کامل درون کدام کشور قرار گرفته است؟','نامیبیا','آفریقای جنوبی','بوتسوانا','زیمبابوه','B','لسوتو کشوری محصور در خاک آفریقای جنوبی است.','ACTIVE','CURATED'),
  ('fa','history','EASY','تخت جمشید در زمان کدام دودمان ساخته شد؟','ساسانیان','اشکانیان','هخامنشیان','صفویان','C','ساخت مجموعه تخت جمشید در دوره هخامنشی آغاز شد.','ACTIVE','CURATED'),
  ('fa','history','MEDIUM','فرمان مشهور منشور حقوق شهروندی کوروش به کدام شهر باستانی مربوط است؟','بابل','شوش','تخت جمشید','هگمتانه','A','استوانه کوروش در بابل به دست آمده است.','ACTIVE','CURATED'),
  ('fa','history','HARD','نبرد ماراتون میان یونانیان و کدام امپراتوری رخ داد؟','روم','هخامنشی','عثمانی','مقدونی','B','نبرد ماراتون در جریان جنگ‌های ایران و یونان رخ داد.','ACTIVE','CURATED'),
  ('fa','science','EASY','کدام سیاره به سیاره سرخ معروف است؟','زهره','مریخ','مشتری','عطارد','B','وجود اکسیدهای آهن در سطح مریخ رنگ سرخ آن را ایجاد می‌کند.','ACTIVE','CURATED'),
  ('fa','science','MEDIUM','نماد شیمیایی عنصر سدیم چیست؟','S','So','Na','Sd','C','نماد سدیم از نام لاتین آن، Natrium، گرفته شده است.','ACTIVE','CURATED'),
  ('fa','science','HARD','کدام ذره زیر بار الکتریکی منفی دارد؟','پروتون','نوترون','الکترون','پوزیترون','C','الکترون دارای بار منفی است.','ACTIVE','CURATED'),
  ('fa','sports','EASY','در فوتبال، هر تیم در آغاز مسابقه چند بازیکن داخل زمین دارد؟','۹','۱۰','۱۱','۱۲','C','هر تیم فوتبال با ۱۱ بازیکن بازی را آغاز می‌کند.','ACTIVE','CURATED'),
  ('fa','sports','MEDIUM','مسابقه تنیس گرند اسلم ویمبلدون روی چه نوع زمینی برگزار می‌شود؟','خاک رس','چمن','زمین سخت','چوب','B','ویمبلدون تنها گرند اسلمی است که روی چمن برگزار می‌شود.','ACTIVE','CURATED'),
  ('fa','sports','HARD','در بازی شطرنج، کدام مهره می‌تواند از روی مهره‌های دیگر بپرد؟','رخ','فیل','اسب','وزیر','C','اسب تنها مهره‌ای است که می‌تواند از روی مهره‌ها بپرد.','ACTIVE','CURATED'),
  ('fa','literature','EASY','سراینده شاهنامه کیست؟','سعدی','فردوسی','حافظ','مولوی','B','شاهنامه اثر حماسی ابوالقاسم فردوسی است.','ACTIVE','CURATED'),
  ('fa','literature','MEDIUM','کتاب گلستان اثر کدام نویسنده ایرانی است؟','نظامی','عطار','سعدی','خیام','C','گلستان از آثار شناخته‌شده سعدی است.','ACTIVE','CURATED'),
  ('fa','literature','HARD','رمان «دن کیشوت» را چه کسی نوشته است؟','ویکتور هوگو','میگل د سروانتس','چارلز دیکنز','فئودور داستایفسکی','B','دن کیشوت اثر نویسنده اسپانیایی میگل د سروانتس است.','ACTIVE','CURATED'),
  ('fa','art','EASY','کدام هنر با دوربین و ثبت تصویر سروکار دارد؟','مجسمه‌سازی','عکاسی','معماری','خوشنویسی','B','عکاسی هنر ثبت تصویر با ابزار نوری است.','ACTIVE','CURATED'),
  ('fa','art','MEDIUM','تابلوی مونالیزا اثر کدام هنرمند است؟','ونسان ون‌گوگ','پابلو پیکاسو','لئوناردو داوینچی','کلود مونه','C','مونالیزا از آثار مشهور لئوناردو داوینچی است.','ACTIVE','CURATED'),
  ('fa','art','HARD','سبک هنری امپرسیونیسم ابتدا در کدام کشور شکل گرفت؟','ایتالیا','فرانسه','آلمان','هلند','B','امپرسیونیسم در فرانسه و در قرن نوزدهم شکل گرفت.','ACTIVE','CURATED'),
  ('fa','religion','EASY','کتاب مقدس مسلمانان چه نام دارد؟','تورات','انجیل','قرآن','اوستا','C','قرآن کتاب مقدس دین اسلام است.','ACTIVE','CURATED'),
  ('fa','religion','MEDIUM','ماه رمضان در تقویم هجری قمری، ماه چندم است؟','هشتم','نهم','دهم','یازدهم','B','رمضان نهمین ماه تقویم هجری قمری است.','ACTIVE','CURATED'),
  ('fa','religion','HARD','در متون اسلامی، لقب «ذوالنون» به کدام پیامبر اشاره دارد؟','یونس','موسی','یوسف','داوود','A','ذوالنون از لقب‌های پیامبر یونس است.','ACTIVE','CURATED'),
  ('fa','culture','EASY','نوروز با آغاز کدام فصل همراه است؟','بهار','تابستان','پاییز','زمستان','A','نوروز با اعتدال بهاری و آغاز بهار در نیمکره شمالی همراه است.','ACTIVE','CURATED'),
  ('fa','culture','MEDIUM','ساز سنتی تار در کدام خانواده سازها قرار می‌گیرد؟','بادی','زهی','کوبه‌ای','الکترونیک','B','تار سازی زهی و مضرابی است.','ACTIVE','CURATED'),
  ('fa','culture','HARD','خط میخی در کدام تمدن باستانی میان‌رودان از نخستین نمونه‌های آن پدید آمد؟','سومر','فنیقیه','روم','مصر بطلمیوسی','A','از نخستین نمونه‌های خط میخی در تمدن سومر شکل گرفت.','ACTIVE','CURATED'),
  ('fa','technology','EASY','واحد اصلی اندازه‌گیری اطلاعات دیجیتال چیست؟','متر','بایت','وات','هرتز','B','بایت یکی از واحدهای پایه برای اندازه‌گیری داده دیجیتال است.','ACTIVE','CURATED'),
  ('fa','technology','MEDIUM','کدام پروتکل معمولاً برای انتقال امن صفحات وب استفاده می‌شود؟','HTTP','FTP','HTTPS','SMTP','C','HTTPS ارتباط وب را با استفاده از رمزنگاری TLS ایمن می‌کند.','ACTIVE','CURATED'),
  ('fa','technology','HARD','در نشانی IPv4 چند بیت برای نمایش آدرس استفاده می‌شود؟','16','32','64','128','B','آدرس IPv4 از ۳۲ بیت تشکیل شده است.','ACTIVE','CURATED'),
  ('fa','general','EASY','در یک شبانه‌روز کامل چند ساعت وجود دارد؟','۱۲','۱۸','۲۴','۳۰','C','یک شبانه‌روز ۲۴ ساعت است.','ACTIVE','CURATED'),
  ('fa','general','MEDIUM','عدد رومی X چه مقداری دارد؟','۵','۱۰','۵۰','۱۰۰','B','در عددنویسی رومی، X برابر ۱۰ است.','ACTIVE','CURATED'),
  ('fa','general','HARD','مجموع زاویه‌های داخلی یک شش‌ضلعی ساده چند درجه است؟','۵۴۰','۶۰۰','۷۲۰','۹۰۰','C','مجموع زاویه‌های داخلی n ضلعی برابر (n−2)×۱۸۰ است؛ برای شش‌ضلعی ۷۲۰ درجه می‌شود.','ACTIVE','CURATED')
ON CONFLICT DO NOTHING;

WITH ranked_after_seed AS (
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
FROM ranked_after_seed r
WHERE q.id = r.id
  AND r.duplicate_rank > 1;

UPDATE quiz_questions q
SET category_id = c.id
FROM quiz_categories c
WHERE q.category = c.slug
  AND q.category_id IS DISTINCT FROM c.id;

CREATE INDEX IF NOT EXISTS idx_quiz_questions_active_difficulty_category
ON quiz_questions (language_code, difficulty, category)
WHERE status = 'ACTIVE';
