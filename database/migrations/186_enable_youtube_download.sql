UPDATE system_settings
SET setting_value = 'true',
    updated_at = NOW()
WHERE setting_key = 'platform.youtube';
