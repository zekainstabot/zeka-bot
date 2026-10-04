INSERT INTO admin_permissions (
    permission_key,
    permission_name,
    description
)
VALUES (
    'bug_reports',
    'گزارش مشکل',
    'دریافت و مدیریت گزارش مشکلات کاربران'
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
    ON p.permission_key = 'bug_reports'
WHERE r.role_key IN (
    'super_admin',
    'admin',
    'support'
)
ON CONFLICT DO NOTHING;
