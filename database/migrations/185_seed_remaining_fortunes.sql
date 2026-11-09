WITH seeded_fortunes(slug, title_fa, content_fa, title_en, content_en) AS (
  VALUES
('daily', 'شروع تازه', 'امروز را با یک تصمیم کوچک و قابل اجرا آغاز کن. لازم نیست همه مسیر را همین حالا بدانی؛ قدم بعدی کافی است.', 'A Fresh Start', 'Begin today with one small, achievable decision. You do not need to know the whole path; the next step is enough.'),
('daily', 'فرصت گفت‌وگو', 'اگر موضوعی ذهنت را مشغول کرده، گفت‌وگویی آرام و روشن می‌تواند ابهام را کمتر کند.', 'A Chance to Talk', 'If something is on your mind, a calm and clear conversation may reduce uncertainty.'),
('daily', 'نظم کوچک', 'یک کار نیمه‌تمام را انتخاب کن و امروز فقط همان را به پایان برسان. پیشرفت کوچک هم پیشرفت است.', 'A Small Routine', 'Choose one unfinished task and complete it today. Small progress is still progress.'),
('daily', 'مراقبت از انرژی', 'برای کارهایت اولویت تعیین کن و برای استراحت هم زمان بگذار. انرژی محدودت را آگاهانه خرج کن.', 'Protect Your Energy', 'Set priorities and make room for rest. Spend your limited energy intentionally.'),
('daily', 'خبر و آگاهی', 'پیش از نتیجه‌گیری، اطلاعات را از منبع معتبر بررسی کن. عجله در قضاوت معمولاً کمکی نمی‌کند.', 'Check the Facts', 'Before reaching a conclusion, verify information with a reliable source. Rushing to judge rarely helps.'),
('daily', 'یک قدم شجاعانه', 'کاری را که مدتی عقب انداخته‌ای به کوچک‌ترین بخش ممکن تقسیم کن و شروعش کن.', 'One Brave Step', 'Break something you have been postponing into the smallest possible step and begin.'),
('daily', 'مهربانی ساده', 'یک رفتار محترمانه یا کمک کوچک می‌تواند روز کسی را بهتر کند؛ بی‌آنکه انتظار جبران داشته باشی.', 'A Simple Kindness', 'A respectful gesture or small act of help can improve someone''s day without expecting anything in return.'),
('daily', 'تمرکز بر امروز', 'به جای نگرانی درباره چند موضوع هم‌زمان، روی مهم‌ترین کاری که امروز در اختیار توست تمرکز کن.', 'Focus on Today', 'Instead of worrying about several things at once, focus on the most important task within your control today.'),
('daily', 'بازنگری برنامه', 'اگر برنامه امروزت عملی نیست، آن را اصلاح کن. تغییر برنامه شکست نیست؛ بخشی از مدیریت درست است.', 'Review Your Plan', 'If today''s plan is unrealistic, adjust it. Changing a plan is not failure; it is part of managing well.'),
('daily', 'پایان آرام', 'پیش از پایان روز، یک موفقیت کوچک و یک نکته برای بهتر شدن فردا را به یاد بیاور.', 'A Calm Ending', 'Before the day ends, remember one small success and one thing you can improve tomorrow.'),
('money', 'بررسی هزینه‌ها', 'پیش از خرید، نیاز واقعی و هزینه نهایی را بررسی کن. چند دقیقه مقایسه می‌تواند از خرج غیرضروری جلوگیری کند.', 'Review Your Spending', 'Before buying, check your actual need and the total cost. A few minutes of comparison can prevent unnecessary spending.'),
('money', 'پس‌انداز پیوسته', 'مبلغی کوچک اما منظم کنار بگذار. استمرار معمولاً از یک تصمیم بزرگ و مقطعی مؤثرتر است.', 'Steady Saving', 'Set aside a small amount regularly. Consistency is often more effective than one large, occasional effort.'),
('money', 'پرهیز از عجله', 'برای تصمیم مالی مهم، به خودت زمان بده و فقط بر اساس وعده سود بالا تصمیم نگیر.', 'Avoid Rushing', 'Give yourself time before an important financial decision; do not rely only on promises of high returns.'),
('money', 'فرصت یادگیری', 'یادگیری یک مهارت کاربردی می‌تواند در بلندمدت ارزشمندتر از دنبال کردن سود سریع باشد.', 'An Opportunity to Learn', 'Learning a practical skill may be more valuable in the long run than chasing quick gains.'),
('money', 'شفافیت حساب', 'درآمد، هزینه و بدهی‌هایت را ثبت کن. دید روشن به اعداد، تصمیم‌گیری را آسان‌تر می‌کند.', 'Clear Records', 'Track income, expenses, and debts. A clear view of the numbers makes decisions easier.'),
('money', 'خرید سنجیده', 'برای خریدهای بزرگ، چند گزینه و شرایط بازگشت یا ضمانت را مقایسه کن.', 'Thoughtful Shopping', 'For major purchases, compare several options and their return or warranty terms.'),
('money', 'هدف مالی', 'یک هدف مشخص با مبلغ و زمان واقع‌بینانه تعیین کن و مسیر رسیدن به آن را به گام‌های کوچک تقسیم کن.', 'A Financial Goal', 'Set a clear goal with a realistic amount and timeline, then divide the path into small steps.'),
('money', 'احتیاط در قرض', 'پیش از قرض دادن یا گرفتن پول، زمان بازپرداخت و شرایط را شفاف و مکتوب مشخص کن.', 'Be Careful with Loans', 'Before lending or borrowing, clearly document the repayment date and terms.'),
('money', 'تنوع درآمد', 'اگر امکانش را داری، به‌تدریج راه‌های قانونی و پایدار افزایش مهارت یا درآمد را بررسی کن.', 'Diversify Your Income', 'If possible, gradually explore lawful and sustainable ways to improve your skills or income.'),
('money', 'آرامش در بازار', 'نوسان کوتاه‌مدت به‌تنهایی دلیل تصمیم عجولانه نیست. ریسک و توان مالی خودت را در نظر بگیر.', 'Stay Calm in Markets', 'Short-term volatility alone is not a reason for a rushed decision. Consider your risk and financial capacity.'),
('intention', 'نیت روشن', 'خواسته‌ات را دقیق برای خودت بیان کن. وقتی مقصد روشن باشد، انتخاب قدم بعدی آسان‌تر می‌شود.', 'A Clear Intention', 'State your wish clearly to yourself. When the destination is clear, choosing the next step becomes easier.'),
('intention', 'صبر همراه عمل', 'برای رسیدن به خواسته‌ات صبور باش، اما صبر را با بی‌عملی اشتباه نگیر؛ قدمی سنجیده بردار.', 'Patience with Action', 'Be patient in pursuing your wish, but do not confuse patience with inaction. Take a thoughtful step.'),
('intention', 'راه تازه', 'اگر راه همیشگی نتیجه نداده، مسئله را از زاویه‌ای تازه بررسی کن و از تجربه دیگران بهره بگیر.', 'A New Approach', 'If the usual path has not worked, examine the problem from a new angle and learn from others.'),
('intention', 'کمک گرفتن', 'لازم نیست همه چیز را به تنهایی حل کنی. درخواست راهنمایی از فرد قابل اعتماد می‌تواند مفید باشد.', 'Ask for Support', 'You do not have to solve everything alone. Guidance from someone trustworthy can help.'),
('intention', 'زمان مناسب', 'برای اقدام مهم، هم آمادگی خودت و هم شرایط واقعی را بسنج؛ نه فقط هیجان لحظه را.', 'The Right Moment', 'For an important action, consider both your readiness and the real circumstances, not just the emotion of the moment.'),
('intention', 'رها کردن مانع', 'مشخص کن کدام نگرانی در اختیار توست و کدام خارج از کنترل تو؛ انرژی را روی بخش قابل تغییر بگذار.', 'Release the Obstacle', 'Identify which concern is within your control and which is not. Put your energy into what can be changed.'),
('intention', 'وفای به عهد', 'اگر به خودت قولی داده‌ای، آن را به یک کار کوچک و زمان مشخص تبدیل کن تا انجامش ممکن شود.', 'Keep Your Promise', 'Turn a promise to yourself into a small task with a clear time so it can be completed.'),
('intention', 'انتخاب آگاهانه', 'پیش از انتخاب، پیامدهای کوتاه‌مدت و بلندمدت هر راه را بنویس و با آرامش مقایسه کن.', 'Choose Consciously', 'Before choosing, write down the short- and long-term consequences of each option and compare them calmly.'),
('intention', 'امید واقع‌بینانه', 'امیدت را حفظ کن و هم‌زمان برای چند نتیجه ممکن آماده باش. انعطاف‌پذیری قدرت است.', 'Realistic Hope', 'Keep your hope while preparing for more than one possible outcome. Flexibility is a strength.'),
('intention', 'آغاز از امروز', 'برای نیتت منتظر شرایط کاملاً بی‌نقص نمان. اگر قدمی امن و منطقی ممکن است، از همان شروع کن.', 'Begin Today', 'Do not wait for perfect conditions. If a safe and sensible first step is possible, start there.')
)
INSERT INTO fortunes (category_id, title, content, title_en, content_en, status)
SELECT c.id, s.title_fa, s.content_fa, s.title_en, s.content_en, 'ACTIVE'
FROM fortune_categories c
JOIN seeded_fortunes s ON s.slug = c.slug
WHERE NOT EXISTS (
  SELECT 1 FROM fortunes f
  WHERE f.category_id = c.id AND f.content = s.content_fa
);
