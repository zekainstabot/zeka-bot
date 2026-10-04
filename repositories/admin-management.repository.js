const {
  getClient,
} = require("../database/client");

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

async function findUserByTelegramId(telegramUserId) {
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

async function findAdminByUserId(userId) {
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

/*
 * تمام Permission های اصلی + وضعیت مؤثر
 *
 * priority:
 * 1. override
 * 2. direct
 * 3. role
 * 4. disabled
 */
async function getAdminPermissions(userId) {
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

          WHEN aup.permission_id IS NOT NULL
            THEN TRUE

          WHEN arp.permission_id IS NOT NULL
            THEN TRUE

          ELSE FALSE
        END AS is_enabled,

        CASE
          WHEN ov.is_enabled IS NOT NULL
            THEN 'override'

          WHEN aup.permission_id IS NOT NULL
            THEN 'direct'

          WHEN arp.permission_id IS NOT NULL
            THEN 'role'

          ELSE 'none'
        END AS source,

        CASE
          WHEN ov.is_enabled IS NOT NULL
            THEN ov.is_enabled
          ELSE NULL
        END AS override_enabled,

        CASE
          WHEN aup.permission_id IS NOT NULL
            THEN TRUE
          ELSE FALSE
        END AS direct_enabled,

        CASE
          WHEN arp.permission_id IS NOT NULL
            THEN TRUE
          ELSE FALSE
        END AS role_enabled

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

      ORDER BY p.permission_key ASC
    `,
    [userId]
  );

  return result.rows;
}

async function getDirectPermissions(userId) {
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

async function getPermissionOverrides(userId) {
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

async function getPermissionOverride(userId, permissionKey) {
  const db = getClient();
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
    [
      userId,
      normalizedKey,
    ]
  );

  return result.rows[0] || null;
}

async function setPermissionOverride(
  userId,
  permissionKey,
  isEnabled
) {
  const db = getClient();
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
  const db = getClient();
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
    [
      userId,
      normalizedKey,
    ]
  );

  return result.rows[0] || null;
}

async function setAdminRole(userId, roleKey) {
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
    [
      userId,
      roleKey,
    ]
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

async function setAdminActive(userId, isActive) {
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

async function removeAdmin(userId) {
  const db = getClient();

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

/*
 * Legacy direct permission
 *
 * برای سازگاری با بخش‌های قدیمی حفظ شده.
 */
async function addDirectPermission(
  userId,
  permissionKey
) {
  const db = getClient();
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
    [
      userId,
      normalizedKey,
    ]
  );

  return result.rows[0] || null;
}

async function removeDirectPermission(
  userId,
  permissionKey
) {
  const db = getClient();
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
    [
      userId,
      normalizedKey,
    ]
  );

  return result.rows[0] || null;
}

async function getActiveAdminsWithPermission(
  permissionKey
) {
  const db = getClient();
  const normalizedKey =
    normalizePermissionKey(permissionKey);

  const result = await db.query(
    `
      SELECT DISTINCT
        u.telegram_user_id,
        u.username,
        u.display_name,
        a.id AS admin_id,
        r.role_key
      FROM admins a
      JOIN users u
        ON u.id = a.user_id
      LEFT JOIN admin_roles r
        ON r.id = a.role_id
      JOIN admin_permissions p
        ON p.permission_key = $1
      WHERE a.is_active = TRUE
        AND (
          r.role_key = 'super_admin'

          OR (
            NOT EXISTS (
              SELECT 1
              FROM admin_user_permission_overrides ov
              WHERE ov.admin_id = a.id
                AND ov.permission_id = p.id
                AND ov.is_enabled = FALSE
            )

            AND (
              EXISTS (
                SELECT 1
                FROM admin_user_permission_overrides ov
                WHERE ov.admin_id = a.id
                  AND ov.permission_id = p.id
                  AND ov.is_enabled = TRUE
              )

              OR EXISTS (
                SELECT 1
                FROM admin_user_permissions aup
                WHERE aup.admin_id = a.id
                  AND aup.permission_id = p.id
              )

              OR EXISTS (
                SELECT 1
                FROM admin_role_permissions arp
                WHERE arp.role_id = a.role_id
                  AND arp.permission_id = p.id
              )
            )
          )
        )
      ORDER BY
        CASE
          WHEN r.role_key = 'super_admin' THEN 1
          WHEN r.role_key = 'admin' THEN 2
          ELSE 3
        END,
        a.id ASC
    `,
    [normalizedKey]
  );

  return result.rows;
}

module.exports = {
  listAdmins,
  findUserByTelegramId,
  findAdminByUserId,

  listRoles,

  getAdminPermissions,
  getDirectPermissions,
  getAllPermissions,

  getPermissionOverrides,
  getPermissionOverride,
  setPermissionOverride,
  removePermissionOverride,

  setAdminRole,
  createAdmin,
  setAdminActive,
  removeAdmin,

  addDirectPermission,
  removeDirectPermission,
};
