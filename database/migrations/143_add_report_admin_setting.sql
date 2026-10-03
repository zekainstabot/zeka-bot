INSERT INTO system_settings
    (
        setting_key,
        setting_value,
        value_type,
        category,
        description,
        is_public
    )
VALUES
    (
        'support.report_admin_id',
        '',
        'string',
        'support',
        'شناسه تلگرام ادمینی که گزارش‌های دانلود را دریافت می‌کند',
        FALSE
    )
ON CONFLICT (setting_key) DO NOTHING;
