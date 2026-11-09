INSERT INTO system_settings
  (setting_key, setting_value, value_type, category, description)
VALUES
  ('platform.tiktok', 'true', 'boolean', 'platform', 'TikTok downloads'),
  ('platform.facebook', 'true', 'boolean', 'platform', 'Facebook downloads'),
  ('platform.x', 'true', 'boolean', 'platform', 'X and Twitter downloads'),
  ('platform.pinterest', 'true', 'boolean', 'platform', 'Pinterest downloads'),
  ('platform.reddit', 'true', 'boolean', 'platform', 'Reddit downloads'),
  ('platform.soundcloud', 'true', 'boolean', 'platform', 'SoundCloud downloads'),
  ('platform.twitch', 'true', 'boolean', 'platform', 'Twitch downloads'),
  ('platform.vimeo', 'true', 'boolean', 'platform', 'Vimeo downloads'),
  ('platform.dailymotion', 'true', 'boolean', 'platform', 'Dailymotion downloads')
ON CONFLICT (setting_key)
DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();
