INSERT INTO admin_permissions (
    permission_key,
    permission_name,
    description
)
VALUES (
    'games.quiz.manage',
    'مدیریت سؤالات مسابقه',
    'افزودن و مدیریت سؤالات مسابقه'
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
    ON p.permission_key = 'games.quiz.manage'
WHERE r.role_key IN (
    'super_admin',
    'admin'
)
ON CONFLICT DO NOTHING;
