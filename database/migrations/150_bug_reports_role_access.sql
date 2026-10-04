DELETE FROM admin_role_permissions
WHERE permission_id = (
    SELECT id
    FROM admin_permissions
    WHERE permission_key = 'bug_reports'
)
AND role_id IN (
    SELECT id
    FROM admin_roles
    WHERE role_key IN (
        'admin',
        'support'
    )
);
