UPDATE wheel_segments
SET probability = CASE segment_number
    WHEN 1 THEN 16.66667
    WHEN 2 THEN 16.66667
    WHEN 3 THEN 16.66666
    WHEN 4 THEN 25.00000
    WHEN 5 THEN 15.00000
    WHEN 6 THEN 7.00000
    WHEN 7 THEN 1.00000
    WHEN 8 THEN 2.00000
    ELSE probability
END
WHERE game_type_id = (
    SELECT id
    FROM game_types
    WHERE game_key = 'wheel_of_fortune'
)
AND segment_number BETWEEN 1 AND 8;
