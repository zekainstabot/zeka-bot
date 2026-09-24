const { getClient } = require("../database/client");

async function findByUserId(userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM users
      WHERE id = $1
        AND is_admin = TRUE
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
      SELECT *
      FROM users
      WHERE telegram_user_id = $1
        AND is_admin = TRUE
      LIMIT 1
    `,
    [telegramUserId]
  );

  return result.rows[0] || null;
}

async function isAdmin(userId) {
  const admin = await findByUserId(userId);
  return Boolean(admin);
}

async function isAdminByTelegramId(telegramUserId) {
  const admin = await findByTelegramId(telegramUserId);
  return Boolean(admin);
}

module.exports = {
  findByUserId,
  findByTelegramId,
  isAdmin,
  isAdminByTelegramId,
};
