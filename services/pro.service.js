const { getClient } = require("../database/client");

async function getProStatusByUserId(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const db = getClient();

  const result = await db.query(
    `
      SELECT
        id,
        telegram_user_id,
        is_pro,
        pro_expires_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  const user = result.rows[0];

  if (!user) {
    return {
      isPro: false,
      expiresAt: null,
    };
  }

  const now = new Date();

  const isPro =
    Boolean(user.is_pro) &&
    (
      !user.pro_expires_at ||
      new Date(user.pro_expires_at) > now
    );

  return {
    isPro,
    expiresAt:
      user.pro_expires_at || null,
  };
}

async function isActivePro(userId) {
  const status =
    await getProStatusByUserId(userId);

  return status.isPro;
}

module.exports = {
  getProStatusByUserId,
  isActivePro,
};
