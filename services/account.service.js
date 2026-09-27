const { getBalance } = require("./credit.service");
const creditRepository = require("../repositories/credit.repository");

async function getAccountSummary(user) {
  if (!user || !user.id) {
    throw new Error("User information is required");
  }

  const accounts = await creditRepository.findByUserId(user.id);

  const now = new Date();

  const activeAccounts = accounts.filter((account) => {
    if (Number(account.remaining_amount || 0) <= 0) {
      return false;
    }

    if (!account.expires_at) {
      return true;
    }

    return new Date(account.expires_at) > now;
  });

  const credit = await getBalance(user.id);

  const credits = {
    rollover: 0,
    daily: 0,
    referral: 0,
    purchased: 0,
    other: 0,
  };

  for (const account of activeAccounts) {
    const amount = Number(account.remaining_amount || 0);
    const source = String(account.source || "")
      .trim()
      .toUpperCase();

    switch (source) {
      case "ROLLOVER":
        credits.rollover += amount;
        break;

      case "DAILY":
        credits.daily += amount;
        break;

      case "REFERRAL":
        credits.referral += amount;
        break;

      case "PURCHASED":
        credits.purchased += amount;
        break;

      default:
        credits.other += amount;
        break;
    }
  }

  const isPro =
    Boolean(user.is_pro) &&
    (!user.pro_expires_at ||
      new Date(user.pro_expires_at) > now);

  return {
    id: user.id,
    telegramUserId: user.telegram_user_id,
    username: user.username || null,
    displayName: user.display_name || null,
    language: user.language || "fa",

    credit: Number(credit || 0),

    credits: {
      rollover: Number(credits.rollover.toFixed(2)),
      daily: Number(credits.daily.toFixed(2)),
      referral: Number(credits.referral.toFixed(2)),
      purchased: Number(credits.purchased.toFixed(2)),
      other: Number(credits.other.toFixed(2)),
    },

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
