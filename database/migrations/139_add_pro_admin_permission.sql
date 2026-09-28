INSERT INTO admin_permissions (
    permission_key,
    permission_name,
    description
)
VALUES (
    'pro.manage',
    'مدیریت Pro',
    'فعال‌سازی، تمدید، خاموش و لغو Pro کاربران'
)
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO admin_role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM admin_roles r
JOIN admin_permissions p
    ON p.permission_key = 'pro.manage'
WHERE r.role_key = 'super_admin'
ON CONFLICT DO NOTHING;
