const { getClient } = require("../database/client");

async function findById(id) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
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
      LIMIT 1
    `,
    [telegramUserId]
  );

  return result.rows[0] || null;
}

async function create(user) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO users (
        telegram_user_id,
        username,
        display_name,
        language
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [
      user.telegramUserId,
      user.username || null,
      user.displayName || null,
      user.language || "fa",
    ]
  );

  return result.rows[0];
}

async function updateByTelegramId(telegramUserId, updates) {
  const db = getClient();

  const allowedFields = [
    "username",
    "display_name",
    "language",
    "is_pro",
    "pro_expires_at",
    "xp",
    "level",
    "streak_days",
    "last_active_at",
  ];

  const entries = Object.entries(updates).filter(([field]) =>
    allowedFields.includes(field)
  );

  if (entries.length === 0) {
    return findByTelegramId(telegramUserId);
  }

  const values = entries.map(([, value]) => value);

  const setClause = entries
    .map(([field], index) => `${field} = $${index + 2}`)
    .join(", ");

  const result = await db.query(
    `
      UPDATE users
      SET ${setClause},
          updated_at = NOW()
      WHERE telegram_user_id = $1
      RETURNING *
    `,
    [telegramUserId, ...values]
  );

  return result.rows[0] || null;
}

module.exports = {
  findById,
  findByTelegramId,
  create,
  updateByTelegramId,
};
