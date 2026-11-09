INSERT INTO system_settings
  (setting_key, setting_value, value_type, category, description)
VALUES
  ('platform.snapchat', 'true', 'boolean', 'platform', 'Snapchat public media downloads'),
  ('platform.threads', 'true', 'boolean', 'platform', 'Threads public media downloads')
ON CONFLICT (setting_key)
DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();
