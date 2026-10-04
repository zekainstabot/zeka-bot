INSERT INTO admin_permissions (
    permission_key,
    permission_name,
    description
)
VALUES
(
    'reports.view',
    'مشاهده گزارش‌ها',
    'مشاهده گزارش‌های ثبت‌شده توسط کاربران'
),
(
    'reports.manage',
    'مدیریت گزارش‌ها',
    'بررسی، تأیید، رد و مدیریت گزارش‌ها'
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
    ON p.permission_key IN (
        'reports.view',
        'reports.manage'
    )
WHERE r.role_key IN (
    'super_admin',
    'admin'
)
ON CONFLICT DO NOTHING;
