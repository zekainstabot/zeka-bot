INSERT INTO system_settings
    (setting_key, setting_value, value_type, category, description)
VALUES
    ('platform.instagram', 'true', 'boolean', 'platform', 'فعال یا غیرفعال بودن دانلود اینستاگرام'),
    ('platform.tiktok', 'false', 'boolean', 'platform', 'فعال یا غیرفعال بودن دانلود تیک‌تاک'),
    ('platform.youtube', 'false', 'boolean', 'platform', 'فعال یا غیرفعال بودن دانلود یوتیوب'),
    ('platform.facebook', 'false', 'boolean', 'platform', 'فعال یا غیرفعال بودن دانلود فیسبوک'),
    ('platform.x', 'false', 'boolean', 'platform', 'فعال یا غیرفعال بودن دانلود X'),
    ('platform.pinterest', 'false', 'boolean', 'platform', 'فعال یا غیرفعال بودن دانلود پینترست'),

    ('feature.watcher', 'false', 'boolean', 'feature', 'فعال یا غیرفعال بودن Watcher'),
    ('feature.collections', 'false', 'boolean', 'feature', 'فعال یا غیرفعال بودن Collections'),
    ('feature.discovery', 'false', 'boolean', 'feature', 'فعال یا غیرفعال بودن Discovery'),
    ('feature.referral', 'false', 'boolean', 'feature', 'فعال یا غیرفعال بودن Referral'),
    ('feature.missions', 'false', 'boolean', 'feature', 'فعال یا غیرفعال بودن Missions'),
    ('feature.luck', 'false', 'boolean', 'feature', 'فعال یا غیرفعال بودن Luck'),
    ('feature.payments', 'false', 'boolean', 'feature', 'فعال یا غیرفعال بودن Payments'),
    ('feature.support', 'true', 'boolean', 'feature', 'فعال یا غیرفعال بودن Support')
ON CONFLICT (setting_key) DO NOTHING;
