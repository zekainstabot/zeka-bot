DELETE FROM admin_role_permissions
WHERE role_id = (
    SELECT id
    FROM admin_roles
    WHERE role_key = 'admin'
);
