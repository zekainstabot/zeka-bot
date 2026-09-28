INSERT INTO game_settings (
    game_type_id,
    setting_key,
    setting_value,
    description
)
SELECT
    g.id,
    s.setting_key,
    s.setting_value,
    s.description
FROM game_types g
CROSS JOIN (
    VALUES
        (
            'quiz_reward',
            '{"credit":0.50,"xp":1}'::JSONB,
            'پاداش جواب درست'
        ),
        (
            'quiz_time_limit',
            '{"seconds":10}'::JSONB,
            'زمان پاسخ به هر سؤال بر حسب ثانیه'
        )
) AS s(
    setting_key,
    setting_value,
    description
)
WHERE g.game_key = 'quiz_general'
ON CONFLICT (
    game_type_id,
    setting_key
) DO NOTHING;
