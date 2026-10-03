INSERT INTO admin_permissions (
    permission_key,
    permission_name,
    description
)
VALUES (
    'features.fortune.manage',
    'مدیریت فال',
    'افزودن و مدیریت محتوای فال'
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
CROSS JOIN admin_permissions p
WHERE
    r.role_key IN ('admin', 'super_admin')
    AND p.permission_key = 'features.fortune.manage'
ON CONFLICT DO NOTHING;
