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
        p.id,
        p.permission_key,
        p.permission_name,
        p.description,

        CASE
          WHEN ov.is_enabled IS NOT NULL
            THEN ov.is_enabled

          WHEN dp.permission_id IS NOT NULL
            THEN TRUE

          WHEN rp.permission_id IS NOT NULL
            THEN TRUE

          ELSE FALSE
        END AS is_enabled,

        CASE
          WHEN ov.is_enabled IS NOT NULL
            THEN 'override'

          WHEN dp.permission_id IS NOT NULL
            THEN 'direct'

          WHEN rp.permission_id IS NOT NULL
            THEN 'role'

          ELSE 'none'
        END AS source,

        CASE
          WHEN ov.is_enabled IS NOT NULL
            THEN ov.is_enabled
          ELSE NULL
        END AS override_enabled,

        CASE
          WHEN rp.permission_id IS NOT NULL
            THEN TRUE
          ELSE FALSE
        END AS role_enabled,

        CASE
          WHEN dp.permission_id IS NOT NULL
            THEN TRUE
          ELSE FALSE
        END AS direct_enabled

      FROM admins a

      CROSS JOIN admin_permissions p

      LEFT JOIN admin_role_permissions arp
        ON arp.role_id = a.role_id
       AND arp.permission_id = p.id

      LEFT JOIN admin_user_permissions aup
        ON aup.admin_id = a.id
       AND aup.permission_id = p.id

      LEFT JOIN admin_user_permission_overrides ov
        ON ov.admin_id = a.id
       AND ov.permission_id = p.id

      WHERE a.user_id = $1
        AND a.is_active = TRUE

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

async function getDirectPermissionsByAdminId(adminId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        p.id,
        p.permission_key,
        p.permission_name,
        p.description
      FROM admin_user_permissions aup
      JOIN admin_permissions p
        ON p.id = aup.permission_id
      WHERE aup.admin_id = $1
      ORDER BY p.permission_key ASC
    `,
    [adminId]
  );

  return result.rows;
}

async function getDirectPermissionsByUserId(userId) {
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

async function getPermissionOverride(
  userId,
  permissionKey
) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        ov.id,
        ov.admin_id,
        ov.permission_id,
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
    [userId, permissionKey]
  );

  return result.rows[0] || null;
}

async function getPermissionOverridesByUserId(userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        p.id,
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

async function setPermissionOverride(
  userId,
  permissionKey,
  isEnabled
) {
  const db = getClient();

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
      permissionKey,
      Boolean(isEnabled),
    ]
  );

  return result.rows[0] || null;
}

async function removePermissionOverride(
  userId,
  permissionKey
) {
  const db = getClient();

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
    [userId, permissionKey]
  );

  return result.rows[0] || null;
}

async function hasPermission(
  userId,
  permissionKey
) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        CASE

          /*
           * Explicit user override always wins.
           */
          WHEN ov.is_enabled IS NOT NULL
            THEN ov.is_enabled

          /*
           * No override:
           * direct permission or role permission grants access.
           */
          WHEN dp.permission_id IS NOT NULL
            THEN TRUE

          WHEN rp.permission_id IS NOT NULL
            THEN TRUE

          ELSE FALSE

        END AS allowed

      FROM admins a

      JOIN admin_roles r
        ON r.id = a.role_id

      JOIN admin_permissions p
        ON p.permission_key = $2

      LEFT JOIN admin_role_permissions arp
        ON arp.role_id = a.role_id
       AND arp.permission_id = p.id

      LEFT JOIN admin_user_permissions aup
        ON aup.admin_id = a.id
       AND aup.permission_id = p.id

      LEFT JOIN admin_user_permission_overrides ov
        ON ov.admin_id = a.id
       AND ov.permission_id = p.id

      WHERE a.user_id = $1
        AND a.is_active = TRUE

      LIMIT 1
    `,
    [userId, permissionKey]
  );

  if (!result.rows.length) {
    return false;
  }

  return result.rows[0].allowed === true;
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
      RETURNING
        id,
        admin_id,
        permission_id
    `,
    [userId, permissionKey]
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
      RETURNING
        aup.id,
        aup.admin_id,
        aup.permission_id
    `,
    [userId, permissionKey]
  );

  return result.rows[0] || null;
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

async function setActive(
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
    [userId, Boolean(isActive)]
  );

  return result.rows[0] || null;
}

async function updateLastLogin(
  userId
) {
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
  const admin =
    await findByUserId(userId);

  return Boolean(
    admin &&
    admin.is_active
  );
}

async function isAdminByTelegramId(
  telegramUserId
) {
  const admin =
    await findByTelegramId(
      telegramUserId
    );

  return Boolean(
    admin &&
    admin.is_active
  );
}

module.exports = {
  findByUserId,
  findByTelegramId,

  getPermissionsByUserId,
  getAllPermissions,

  getDirectPermissionsByAdminId,
  getDirectPermissionsByUserId,

  getPermissionOverride,
  getPermissionOverridesByUserId,
  setPermissionOverride,
  removePermissionOverride,

  hasPermission,

  addDirectPermission,
  removeDirectPermission,

  create,
  setActive,
  updateLastLogin,

  isAdmin,
  isAdminByTelegramId,
};
