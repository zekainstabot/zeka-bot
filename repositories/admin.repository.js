const { getClient } = require("../database/client");

async function findByUserId(userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        a.id,
        a.user_id,
        a.role_id,
        a.is_active,
        a.last_login_at,
        a.created_at,
        a.updated_at,
        r.role_key,
        r.role_name,
        r.description AS role_description
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

async function findByTelegramId(telegramUserId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        a.id,
        a.user_id,
        a.role_id,
        a.is_active,
        a.last_login_at,
        a.created_at,
        a.updated_at,
        r.role_key,
        r.role_name,
        r.description AS role_description
      FROM admins a
      JOIN users u
        ON u.id = a.user_id
      JOIN admin_roles r
        ON r.id = a.role_id
      WHERE u.telegram_user_id = $1
      LIMIT 1
    `,
    [telegramUserId]
  );

  return result.rows[0] || null;
}

async function getPermissionsByUserId(userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        p.permission_key,
        p.permission_name,
        p.description
      FROM admins a
      JOIN admin_role_permissions arp
        ON arp.role_id = a.role_id
      JOIN admin_permissions p
        ON p.id = arp.permission_id
      WHERE a.user_id = $1
        AND a.is_active = TRUE
      ORDER BY p.permission_key ASC
    `,
    [userId]
  );

  return result.rows;
}

async function hasPermission(userId, permissionKey) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT 1
      FROM admins a
      JOIN admin_role_permissions arp
        ON arp.role_id = a.role_id
      JOIN admin_permissions p
        ON p.id = arp.permission_id
      WHERE a.user_id = $1
        AND a.is_active = TRUE
        AND p.permission_key = $2
      LIMIT 1
    `,
    [userId, permissionKey]
  );

  return result.rowCount > 0;
}

async function create({
  userId,
  roleKey = "admin",
}) {
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
      WHERE r.role_key = $2
      RETURNING *
    `,
    [userId, roleKey]
  );

  return result.rows[0] || null;
}

async function setActive(userId, isActive) {
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
    [userId, Boolean(isActive)]
  );

  return result.rows[0] || null;
}

async function updateLastLogin(userId) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE admins
      SET
        last_login_at = NOW(),
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function isAdmin(userId) {
  const admin = await findByUserId(userId);
  return Boolean(admin && admin.is_active);
}

async function isAdminByTelegramId(telegramUserId) {
  const admin = await findByTelegramId(telegramUserId);
  return Boolean(admin && admin.is_active);
}

module.exports = {
  findByUserId,
  findByTelegramId,
  getPermissionsByUserId,
  hasPermission,
  create,
  setActive,
  updateLastLogin,
  isAdmin,
  isAdminByTelegramId,
};
