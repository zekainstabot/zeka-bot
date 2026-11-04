
INSERT INTO system_settings (
    setting_key,
    setting_value,
    value_type,
    category,
    description
)
VALUES
    (
        'pro.base_price.1',
        '20000',
        'number',
        'pro',
        'قیمت پایه اشتراک Pro یک ماهه به تومان'
    ),
    (
        'pro.base_price.2',
        '38000',
        'number',
        'pro',
        'قیمت پایه اشتراک Pro دو ماهه به تومان'
    ),
    (
        'pro.base_price.3',
        '54000',
        'number',
        'pro',
        'قیمت پایه اشتراک Pro سه ماهه به تومان'
    ),
    (
        'pro.base_price.6',
        '102000',
        'number',
        'pro',
        'قیمت پایه اشتراک Pro شش ماهه به تومان'
    ),
    (
        'pro.base_price.12',
        '192000',
        'number',
        'pro',
        'قیمت پایه اشتراک Pro دوازده ماهه به تومان'
    ),
    (
        'pro.extra_discount_percent',
        '0',
        'number',
        'pro',
        'درصد تخفیف عمومی اشتراک Pro'
    )
ON CONFLICT (setting_key) DO NOTHING;
