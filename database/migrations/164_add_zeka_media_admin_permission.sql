INSERT INTO admin_permissions (
    permission_key,
    permission_name,
    description
)
VALUES (
    'zeka_media',
    'مدیریت زکا مدیا',
    'بررسی، تأیید، رد و انتشار محتوای کانال زکا مدیا'
)
ON CONFLICT (permission_key) DO NOTHING;
