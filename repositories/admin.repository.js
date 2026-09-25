const config = require("../config/app");
const { getClient } = require("../database/client");

function normalizeTelegramId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function isConfiguredAdmin(telegramUserId) {
  const id = normalizeTelegramId(telegramUserId);

  if (id === null) {
    return false;
  }

  return config.admin.telegramIds.includes(id);
}

async function findByUserId(userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  const user = result.rows[0];

  if (!user || !isConfiguredAdmin(user.telegram_user_id)) {
    return null;
  }

  return user;
}

async function findByTelegramId(telegramUserId) {
  const db = getClient();

  const normalizedId = normalizeTelegramId(telegramUserId);

  if (normalizedId === null) {
    return null;
  }

  const result = await db.query(
    `
      SELECT *
      FROM users
      WHERE telegram_user_id = $1
      LIMIT 1
    `,
    [normalizedId]
  );

  const user = result.rows[0];

  if (!user || !isConfiguredAdmin(user.telegram_user_id)) {
    return null;
  }

  return user;
}

async function isAdmin(userId) {
  const admin = await findByUserId(userId);
  return Boolean(admin);
}

async function isAdminByTelegramId(telegramUserId) {
  return isConfiguredAdmin(telegramUserId);
}

module.exports = {
  findByUserId,
  findByTelegramId,
  isAdmin,
  isAdminByTelegramId,
};
