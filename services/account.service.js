const { getBalance } = require("./credit.service");

async function getAccountSummary(user) {
  if (!user || !user.id) {
    throw new Error("User information is required");
  }

  const balance = await getBalance(user.id);

  const isPro =
    Boolean(user.is_pro) &&
    (!user.pro_expires_at ||
      new Date(user.pro_expires_at) > new Date());

  return {
    id: user.id,
    telegramUserId: user.telegram_user_id,
    username: user.username || null,
    displayName: user.display_name || null,
    language: user.language || "fa",

    credit: Number(balance || 0),

    xp: Number(user.xp || 0),
    level: Number(user.level || 0),
    streakDays: Number(user.streak_days || 0),

    isPro,
    proExpiresAt: user.pro_expires_at || null,

    createdAt: user.created_at || null,
  };
}

module.exports = {
  getAccountSummary,
};
