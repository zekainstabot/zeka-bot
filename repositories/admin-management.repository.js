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

async function createAdmin(
  userId
) {
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

module.exports = {
  listAdmins,
  findUserByTelegramId,
  findAdminByUserId,
  createAdmin,
  setAdminActive,
  removeAdmin,
};
