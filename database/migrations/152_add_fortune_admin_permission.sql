INSERT INTO admin_permissions (
    permission_key,
    permission_name,
    description
)
VALUES (
    'features.fortune.manage',
    'مدیریت فال',
    'افزودن، ویرایش و مدیریت فال حافظ'
)
ON CONFLICT (permission_key) DO NOTHING;
