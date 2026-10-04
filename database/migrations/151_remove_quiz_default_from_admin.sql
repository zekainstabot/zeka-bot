DELETE FROM admin_role_permissions
WHERE permission_id = (
    SELECT id
    FROM admin_permissions
    WHERE permission_key = 'games.quiz'
)
AND role_id IN (
    SELECT id
    FROM admin_roles
    WHERE role_key = 'admin'
);
