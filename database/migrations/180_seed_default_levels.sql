INSERT INTO levels (
    level_number,
    required_xp,
    title_key,
    description_key,
    credit_reward,
    pro_days,
    status,
    metadata
)
VALUES
    (1,    0, 'تازه‌وارد',       'شروع مسیر زکا',             0, 0, 'ACTIVE', '{"badge":"🌱"}'::jsonb),
    (2,  100, 'همراه',           '۱۰۰ امتیاز تجربه',           0, 0, 'ACTIVE', '{"badge":"⭐"}'::jsonb),
    (3,  250, 'فعال',             '۲۵۰ امتیاز تجربه',           0, 0, 'ACTIVE', '{"badge":"⚡"}'::jsonb),
    (4,  500, 'پرتلاش',           '۵۰۰ امتیاز تجربه',           0, 0, 'ACTIVE', '{"badge":"🔥"}'::jsonb),
    (5,  900, 'حرفه‌ای',          '۹۰۰ امتیاز تجربه',           0, 0, 'ACTIVE', '{"badge":"🏅"}'::jsonb),
    (6, 1400, 'متخصص',            '۱۴۰۰ امتیاز تجربه',          0, 0, 'ACTIVE', '{"badge":"💎"}'::jsonb),
    (7, 2000, 'استاد',            '۲۰۰۰ امتیاز تجربه',          0, 0, 'ACTIVE', '{"badge":"👑"}'::jsonb),
    (8, 2800, 'نخبه',             '۲۸۰۰ امتیاز تجربه',          0, 0, 'ACTIVE', '{"badge":"🚀"}'::jsonb),
    (9, 3800, 'قهرمان زکا',        '۳۸۰۰ امتیاز تجربه',          0, 0, 'ACTIVE', '{"badge":"🏆"}'::jsonb),
    (10, 5000, 'افسانه زکا',       '۵۰۰۰ امتیاز تجربه',          0, 0, 'ACTIVE', '{"badge":"🌟"}'::jsonb)
ON CONFLICT (level_number) DO UPDATE
SET
    required_xp = EXCLUDED.required_xp,
    title_key = EXCLUDED.title_key,
    description_key = EXCLUDED.description_key,
    status = 'ACTIVE',
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

UPDATE users u
SET level = COALESCE((
    SELECT l.level_number
    FROM levels l
    WHERE l.status = 'ACTIVE'
      AND l.required_xp <= GREATEST(COALESCE(u.xp, 0), 0)
    ORDER BY l.required_xp DESC, l.level_number DESC
    LIMIT 1
), 1),
updated_at = NOW()
WHERE u.level IS DISTINCT FROM COALESCE((
    SELECT l.level_number
    FROM levels l
    WHERE l.status = 'ACTIVE'
      AND l.required_xp <= GREATEST(COALESCE(u.xp, 0), 0)
    ORDER BY l.required_xp DESC, l.level_number DESC
    LIMIT 1
), 1);
