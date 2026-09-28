INSERT INTO game_settings (
    game_type_id,
    setting_key,
    setting_value,
    description
)
SELECT
    g.id,
    'quiz_daily_credit_cap',
    '{"credit":5.00}'::JSONB,
    'سقف پاداش Credit مسابقه در هر روز'
FROM game_types g
WHERE g.game_key = 'quiz_general'
ON CONFLICT (
    game_type_id,
    setting_key
)
DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description;
