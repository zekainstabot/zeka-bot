const {
  getClient,
} = require("../database/client");

async function listAdmins() {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        a.id,
        a.user_id,
        a.is_active,
        a.last_login_at,
        a.created_at,
        u.telegram_user_id,
        u.username,
        u.display_name,
        r.role_key,
        r.role_name
      FROM admins a
      JOIN users u
        ON u.id = a.user_id
      JOIN admin_roles r
        ON r.id = a.role_id
      ORDER BY
        CASE
          WHEN r.role_key = 'super_admin' THEN 1
          WHEN r.role_key = 'admin' THEN 2
          ELSE 3
        END,
        a.created_at ASC
    `
  );

  return result.rows;
}

async function findUserByTelegramId(
  telegramUserId
) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        id,
        telegram_user_id,
        username,
        display_name
      FROM users
      WHERE telegram_user_id = $1
      LIMIT 1
    `,
    [telegramUserId]
  );

  return result.rows[0] || null;
}

async function findAdminByUserId(
  userId
) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        a.id,
        a.user_id,
        a.is_active,
        a.role_id,
        r.role_key,
        r.role_name
      FROM admins a
      JOIN admin_roles r
        ON r.id = a.role_id
      WHERE a.user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function listRoles() {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        id,
        role_key,
        role_name,
        description
      FROM admin_roles
      WHERE role_key <> 'super_admin'
      ORDER BY
        CASE
          WHEN role_key = 'admin' THEN 1
          ELSE 2
        END,
        id ASC
    `
  );

  return result.rows;
}

async function getAdminPermissions(
  userId
) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT DISTINCT
        p.id,
        p.permission_key,
        p.permission_name,
        p.description,
        'role' AS source
      FROM admins a
      JOIN admin_role_permissions arp
        ON arp.role_id = a.role_id
      JOIN admin_permissions p
        ON p.id = arp.permission_id
      WHERE a.user_id = $1
        AND a.is_active = TRUE

      UNION

      SELECT DISTINCT
        p.id,
        p.permission_key,
        p.permission_name,
        p.description,
        'direct' AS source
      FROM admins a
      JOIN admin_user_permissions aup
        ON aup.admin_id = a.id
      JOIN admin_permissions p
        ON p.id = aup.permission_id
      WHERE a.user_id = $1
        AND a.is_active = TRUE

      ORDER BY permission_key ASC
    `,
    [userId]
  );

  return result.rows;
}

async function getDirectPermissions(
  userId
) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        p.id,
        p.permission_key,
        p.permission_name,
        p.description
      FROM admins a
      JOIN admin_user_permissions aup
        ON aup.admin_id = a.id
      JOIN admin_permissions p
        ON p.id = aup.permission_id
      WHERE a.user_id = $1
      ORDER BY p.permission_key ASC
    `,
    [userId]
  );

  return result.rows;
}

async function getAllPermissions() {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        id,
        permission_key,
        permission_name,
        description
      FROM admin_permissions
      ORDER BY permission_key ASC
    `
  );

  return result.rows;
}

async function setAdminRole(
  userId,
  roleKey
) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE admins a
      SET
        role_id = r.id,
        updated_at = NOW()
      FROM admin_roles r
      WHERE a.user_id = $1
        AND r.role_key = $2
        AND r.role_key <> 'super_admin'
      RETURNING
        a.*,
        r.role_key,
        r.role_name
    `,
    [userId, roleKey]
  );

  return result.rows[0] || null;
}

async function createAdmin(userId) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO admins (
        user_id,
        role_id
      )
      SELECT
        $1,
        r.id
      FROM admin_roles r
      WHERE r.role_key = 'admin'
      RETURNING *
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function setAdminActive(
  userId,
  isActive
) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE admins
      SET
        is_active = $2,
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `,
    [
      userId,
      Boolean(isActive),
    ]
  );

  return result.rows[0] || null;
}

async function removeAdmin(
  userId
) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM admins
      WHERE user_id = $1
        AND role_id = (
          SELECT id
          FROM admin_roles
          WHERE role_key = 'admin'
          LIMIT 1
        )
      RETURNING *
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function addDirectPermission(
  userId,
  permissionKey
) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO admin_user_permissions (
        admin_id,
        permission_id
      )
      SELECT
        a.id,
        p.id
      FROM admins a
      JOIN admin_permissions p
        ON p.permission_key = $2
      WHERE a.user_id = $1
      ON CONFLICT (
        admin_id,
        permission_id
      )
      DO NOTHING
      RETURNING *
    `,
    [
      userId,
      permissionKey,
    ]
  );

  return result.rows[0] || null;
}

async function removeDirectPermission(
  userId,
  permissionKey
) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM admin_user_permissions aup
      USING admins a,
            admin_permissions p
      WHERE aup.admin_id = a.id
        AND aup.permission_id = p.id
        AND a.user_id = $1
        AND p.permission_key = $2
      RETURNING aup.*
    `,
    [
      userId,
      permissionKey,
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  listAdmins,
  findUserByTelegramId,
  findAdminByUserId,

  listRoles,

  getAdminPermissions,
  getDirectPermissions,
  getAllPermissions,

  setAdminRole,
  createAdmin,
  setAdminActive,
  removeAdmin,

  addDirectPermission,
  removeDirectPermission,
};
