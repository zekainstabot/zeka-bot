const { getClient } = require("../database/client");

const db = getClient();

const PERMISSION_ALIASES = {
  "users.view": "users",
  "users.manage": "users",
  "settings.view": "settings",
  "settings.manage": "settings",
  "requests.view": "requests",
  "requests.manage": "requests",
  "credits.view": "credits",
  "credits.manage": "credits",
  "rewards.view": "rewards",
  "rewards.manage": "rewards",
  "platforms.view": "platforms",
  "platforms.manage": "platforms",
  "features.view": "features",
  "features.manage": "features",
  "support.view": "support",
  "support.manage": "support",
  "monitoring.view": "monitoring",
  "admins.view": "admins",
  "admins.manage": "admins",
  "reports.view": "reports",
  "reports.manage": "reports",
  "games.quiz.manage": "games.quiz",
  "pro.manage": "pro",
};

function normalizePermissionKey(permissionKey) {
  return PERMISSION_ALIASES[permissionKey] || permissionKey;
}

async function findByTelegramId(telegramUserId) {
  const result = await db.query(
    `
      SELECT
        a.*,
        u.id AS user_id,
        u.telegram_user_id,
        u.username,
        u.display_name,
        ar.role_key,
        ar.role_name
      FROM admins a
      JOIN users u
        ON u.id = a.user_id
      LEFT JOIN admin_roles ar
        ON ar.id = a.role_id
      WHERE u.telegram_user_id = $1
      LIMIT 1
    `,
    [telegramUserId]
  );

  return result.rows[0] || null;
}

async function findByUserId(userId) {
  const result = await db.query(
    `
      SELECT
        a.*,
        u.telegram_user_id,
        u.username,
        u.display_name,
        ar.role_key,
        ar.role_name
      FROM admins a
      JOIN users u
        ON u.id = a.user_id
      LEFT JOIN admin_roles ar
        ON ar.id = a.role_id
      WHERE a.user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function getAdminById(adminId) {
  const result = await db.query(
    `
      SELECT
        a.*,
        u.telegram_user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.display_name,
        ar.role_key,
        ar.role_name
      FROM admins a
      JOIN users u
        ON u.id = a.user_id
      LEFT JOIN admin_roles ar
        ON ar.id = a.role_id
      WHERE a.id = $1
      LIMIT 1
    `,
    [adminId]
  );

  return result.rows[0] || null;
}

async function getAdmins() {
  const result = await db.query(
    `
      SELECT
        a.*,
        u.telegram_user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.display_name,
        ar.role_key,
        ar.role_name
      FROM admins a
      JOIN users u
        ON u.id = a.user_id
      LEFT JOIN admin_roles ar
        ON ar.id = a.role_id
      ORDER BY
        CASE
          WHEN ar.role_key = 'super_admin' THEN 1
          WHEN ar.role_key = 'admin' THEN 2
          ELSE 3
        END,
        a.created_at ASC,
        a.id ASC
    `
  );

  return result.rows;
}

async function isAdmin(userId) {
  const result = await db.query(
    `
      SELECT 1
      FROM admins
      WHERE user_id = $1
        AND is_active = TRUE
      LIMIT 1
    `,
    [userId]
  );

  return result.rows.length > 0;
}

async function isAdminByTelegramId(telegramUserId) {
  const result = await db.query(
    `
      SELECT 1
      FROM admins a
      JOIN users u
        ON u.id = a.user_id
      WHERE u.telegram_user_id = $1
        AND a.is_active = TRUE
      LIMIT 1
    `,
    [telegramUserId]
  );

  return result.rows.length > 0;
}

async function create({ userId, roleKey = "admin" }) {
  const result = await db.query(
    `
      INSERT INTO admins (
        user_id,
        role_id,
        is_active
      )
      SELECT
        $1,
        r.id,
        TRUE
      FROM admin_roles r
      WHERE r.role_key = $2
      RETURNING *
    `,
    [userId, roleKey]
  );

  return result.rows[0] || null;
}

async function createAdmin(userId, roleId = null) {
  const result = await db.query(
    `
      INSERT INTO admins (
        user_id,
        role_id,
        is_active
      )
      VALUES ($1, $2, TRUE)
      RETURNING *
    `,
    [userId, roleId]
  );

  return result.rows[0] || null;
}

async function setActive(userId, isActive) {
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

async function setAdminActive(adminId, isActive) {
  const result = await db.query(
    `
      UPDATE admins
      SET
        is_active = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [adminId, Boolean(isActive)]
  );

  return result.rows[0] || null;
}

async function updateAdminRole(adminId, roleId) {
  const result = await db.query(
    `
      UPDATE admins
      SET
        role_id = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [adminId, roleId]
  );

  return result.rows[0] || null;
}

async function setAdminRole(userId, roleKey) {
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

async function updateLastLogin(userId) {
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

async function deleteAdmin(adminId) {
  const result = await db.query(
    `
      DELETE FROM admins
      WHERE id = $1
      RETURNING *
    `,
    [adminId]
  );

  return result.rows[0] || null;
}

async function removeAdmin(userId) {
  const result = await db.query(
    `
      DELETE FROM admins a
      USING admin_roles r
      WHERE a.user_id = $1
        AND a.role_id = r.id
        AND r.role_key <> 'super_admin'
      RETURNING a.*
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function getPermissionsByUserId(userId) {
  const result = await db.query(
    `
      SELECT
        p.permission_key,
        p.permission_name,
        p.description,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM admin_user_permission_overrides ov
            WHERE ov.admin_id = a.id
              AND ov.permission_id = p.id
              AND ov.is_enabled = FALSE
          ) THEN FALSE

          WHEN EXISTS (
            SELECT 1
            FROM admin_user_permission_overrides ov
            WHERE ov.admin_id = a.id
              AND ov.permission_id = p.id
              AND ov.is_enabled = TRUE
          ) THEN TRUE

          WHEN EXISTS (
            SELECT 1
            FROM admin_user_permissions aup
            WHERE aup.admin_id = a.id
              AND aup.permission_id = p.id
          ) THEN TRUE

          WHEN EXISTS (
            SELECT 1
            FROM admin_role_permissions arp
            WHERE arp.role_id = a.role_id
              AND arp.permission_id = p.id
          ) THEN TRUE

          ELSE FALSE
        END AS allowed
      FROM admins a
      CROSS JOIN admin_permissions p
      WHERE a.user_id = $1
      GROUP BY
        a.id,
        a.role_id,
        p.id,
        p.permission_key,
        p.permission_name,
        p.description
      ORDER BY p.id ASC
    `,
    [userId]
  );

  return result.rows;
}

async function hasPermission(userId, permissionKey) {
  const normalizedKey = normalizePermissionKey(permissionKey);

  const result = await db.query(
    `
      SELECT
        CASE
          WHEN ar.role_key = 'super_admin' THEN TRUE

          WHEN EXISTS (
            SELECT 1
            FROM admin_user_permission_overrides ov
            WHERE ov.admin_id = a.id
              AND ov.permission_id = p.id
              AND ov.is_enabled = FALSE
          ) THEN FALSE

          WHEN EXISTS (
            SELECT 1
            FROM admin_user_permission_overrides ov
            WHERE ov.admin_id = a.id
              AND ov.permission_id = p.id
              AND ov.is_enabled = TRUE
          ) THEN TRUE

          WHEN EXISTS (
            SELECT 1
            FROM admin_user_permissions aup
            WHERE aup.admin_id = a.id
              AND aup.permission_id = p.id
          ) THEN TRUE

          WHEN EXISTS (
            SELECT 1
            FROM admin_role_permissions arp
            WHERE arp.role_id = a.role_id
              AND arp.permission_id = p.id
          ) THEN TRUE

          ELSE FALSE
        END AS allowed
      FROM admins a
      LEFT JOIN admin_roles ar
        ON ar.id = a.role_id
      CROSS JOIN admin_permissions p
      WHERE a.user_id = $1
        AND p.permission_key = $2
        AND a.is_active = TRUE
      LIMIT 1
    `,
    [userId, normalizedKey]
  );

  return result.rows[0]?.allowed === true;
}

async function getAllPermissions() {
  const result = await db.query(
    `
      SELECT
        id,
        permission_key,
        permission_name,
        description
      FROM admin_permissions
      ORDER BY id ASC
    `
  );

  return result.rows;
}

async function getPermissionByKey(permissionKey) {
  const normalizedKey = normalizePermissionKey(permissionKey);

  const result = await db.query(
    `
      SELECT
        id,
        permission_key,
        permission_name,
        description
      FROM admin_permissions
      WHERE permission_key = $1
      LIMIT 1
    `,
    [normalizedKey]
  );

  return result.rows[0] || null;
}

async function getDirectPermissionsByUserId(userId) {
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

async function addDirectPermission(userId, permissionKey) {
  const normalizedKey = normalizePermissionKey(permissionKey);

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
    [userId, normalizedKey]
  );

  return result.rows[0] || null;
}

async function removeDirectPermission(userId, permissionKey) {
  const normalizedKey = normalizePermissionKey(permissionKey);

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
    [userId, normalizedKey]
  );

  return result.rows[0] || null;
}

async function addPermissionToAdmin(adminId, permissionId) {
  const result = await db.query(
    `
      INSERT INTO admin_user_permissions (
        admin_id,
        permission_id
      )
      VALUES ($1, $2)
      ON CONFLICT (
        admin_id,
        permission_id
      )
      DO NOTHING
      RETURNING *
    `,
    [adminId, permissionId]
  );

  return result.rows[0] || null;
}

async function removePermissionFromAdmin(adminId, permissionId) {
  const result = await db.query(
    `
      DELETE FROM admin_user_permissions
      WHERE admin_id = $1
        AND permission_id = $2
      RETURNING *
    `,
    [adminId, permissionId]
  );

  return result.rows[0] || null;
}

async function getPermissionOverride(userId, permissionKey) {
  const normalizedKey = normalizePermissionKey(permissionKey);

  const result = await db.query(
    `
      SELECT
        ov.id,
        ov.admin_id,
        ov.permission_id,
        p.permission_key,
        ov.is_enabled,
        ov.created_at,
        ov.updated_at
      FROM admins a
      JOIN admin_user_permission_overrides ov
        ON ov.admin_id = a.id
      JOIN admin_permissions p
        ON p.id = ov.permission_id
      WHERE a.user_id = $1
        AND p.permission_key = $2
      LIMIT 1
    `,
    [userId, normalizedKey]
  );

  return result.rows[0] || null;
}

async function getPermissionOverridesByUserId(userId) {
  const result = await db.query(
    `
      SELECT
        ov.id,
        ov.admin_id,
        ov.permission_id,
        p.permission_key,
        p.permission_name,
        p.description,
        ov.is_enabled,
        ov.created_at,
        ov.updated_at
      FROM admins a
      JOIN admin_user_permission_overrides ov
        ON ov.admin_id = a.id
      JOIN admin_permissions p
        ON p.id = ov.permission_id
      WHERE a.user_id = $1
      ORDER BY p.permission_key ASC
    `,
    [userId]
  );

  return result.rows;
}

async function getPermissionOverrides(adminId) {
  const result = await db.query(
    `
      SELECT
        ov.id,
        ov.admin_id,
        ov.permission_id,
        ov.is_enabled,
        ov.created_at,
        ov.updated_at,
        p.permission_key,
        p.permission_name,
        p.description AS permission_description
      FROM admin_user_permission_overrides ov
      JOIN admin_permissions p
        ON p.id = ov.permission_id
      WHERE ov.admin_id = $1
      ORDER BY p.id ASC
    `,
    [adminId]
  );

  return result.rows;
}

async function setPermissionOverride(
  userId,
  permissionKey,
  isEnabled
) {
  const normalizedKey = normalizePermissionKey(permissionKey);

  const result = await db.query(
    `
      INSERT INTO admin_user_permission_overrides (
        admin_id,
        permission_id,
        is_enabled
      )
      SELECT
        a.id,
        p.id,
        $3
      FROM admins a
      JOIN admin_permissions p
        ON p.permission_key = $2
      WHERE a.user_id = $1
      ON CONFLICT (
        admin_id,
        permission_id
      )
      DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        updated_at = NOW()
      RETURNING
        id,
        admin_id,
        permission_id,
        is_enabled,
        created_at,
        updated_at
    `,
    [
      userId,
      normalizedKey,
      Boolean(isEnabled),
    ]
  );

  return result.rows[0] || null;
}

async function removePermissionOverride(
  userId,
  permissionKey
) {
  const normalizedKey = normalizePermissionKey(permissionKey);

  const result = await db.query(
    `
      DELETE FROM admin_user_permission_overrides ov
      USING admins a,
            admin_permissions p
      WHERE ov.admin_id = a.id
        AND ov.permission_id = p.id
        AND a.user_id = $1
        AND p.permission_key = $2
      RETURNING
        ov.id,
        ov.admin_id,
        ov.permission_id,
        ov.is_enabled
    `,
    [userId, normalizedKey]
  );

  return result.rows[0] || null;
}

async function setPermissionOverrideById(
  adminId,
  permissionId,
  isEnabled
) {
  const result = await db.query(
    `
      INSERT INTO admin_user_permission_overrides (
        admin_id,
        permission_id,
        is_enabled
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (
        admin_id,
        permission_id
      )
      DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        updated_at = NOW()
      RETURNING *
    `,
    [
      adminId,
      permissionId,
      Boolean(isEnabled),
    ]
  );

  return result.rows[0] || null;
}

async function resetPermissionOverride(
  adminId,
  permissionId
) {
  const result = await db.query(
    `
      DELETE FROM admin_user_permission_overrides
      WHERE admin_id = $1
        AND permission_id = $2
      RETURNING *
    `,
    [adminId, permissionId]
  );

  return result.rows[0] || null;
}

async function resetAllPermissionOverrides(adminId) {
  const result = await db.query(
    `
      DELETE FROM admin_user_permission_overrides
      WHERE admin_id = $1
      RETURNING *
    `,
    [adminId]
  );

  return result.rows;
}

module.exports = {
  findByTelegramId,
  findByUserId,

  getAdminByTelegramUserId: findByTelegramId,
  getAdminByUserId: findByUserId,
  getAdminById,

  getAdmins,

  isAdmin,
  isAdminByTelegramId,

  create,
  createAdmin,

  setActive,
  setAdminActive,

  updateAdminRole,
  setAdminRole,

  updateLastLogin,

  deleteAdmin,
  removeAdmin,

  getPermissionsByUserId,
  hasPermission,

  getAllPermissions,
  getPermissionByKey,

  getDirectPermissionsByUserId,
  addDirectPermission,
  removeDirectPermission,

  addPermissionToAdmin,
  removePermissionFromAdmin,

  getPermissionOverride,
  getPermissionOverridesByUserId,
  getPermissionOverrides,

  setPermissionOverride,
  removePermissionOverride,

  setPermissionOverrideById,
  resetPermissionOverride,
  resetAllPermissionOverrides,
};
