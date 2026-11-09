const { getBalance } = require("./credit.service");
const creditRepository = require("../repositories/credit.repository");
const { getClient } = require("../database/client");

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
    xp: Math.max(0, Number(user.xp || 0)),
    level: Math.max(1, Number(user.level || 1)),
    streakDays: Number(user.streak_days || 0),
    isPro,
    proExpiresAt: user.pro_expires_at || null,
    createdAt: user.created_at || null,
  };
}

async function getLevelProgress(user) {
  if (!user || !user.id) {
    throw new Error("User information is required");
  }

  const db = getClient();
  const xp = Math.max(0, Number(user.xp || 0));

  const result = await db.query(
    `
      SELECT
        level_number,
        required_xp,
        title_key,
        description_key,
        metadata
      FROM levels
      WHERE status = 'ACTIVE'
      ORDER BY required_xp ASC, level_number ASC
    `
  );

  const levels = result.rows.map((level) => ({
    level: Number(level.level_number),
    requiredXp: Number(level.required_xp),
    title: level.title_key || `سطح ${level.level_number}`,
    description: level.description_key || "",
    badge: level.metadata?.badge || "🏅",
  }));

  if (levels.length === 0) {
    throw new Error("No active XP levels configured");
  }

  let currentIndex = 0;

  for (let index = 0; index < levels.length; index += 1) {
    if (xp >= levels[index].requiredXp) {
      currentIndex = index;
    } else {
      break;
    }
  }

  const currentLevel = levels[currentIndex];
  const nextLevel = levels[currentIndex + 1] || null;
  const currentStartXp = currentLevel.requiredXp;
  const nextRequiredXp = nextLevel ? nextLevel.requiredXp : null;
  const xpIntoLevel = Math.max(0, xp - currentStartXp);
  const xpForLevel = nextLevel
    ? Math.max(1, nextRequiredXp - currentStartXp)
    : 0;
  const progressPercent = nextLevel
    ? Math.min(100, Math.floor((xpIntoLevel / xpForLevel) * 100))
    : 100;

  if (Number(user.level || 0) !== currentLevel.level) {
    await db.query(
      `
        UPDATE users
        SET level = $2, updated_at = NOW()
        WHERE id = $1
      `,
      [user.id, currentLevel.level]
    );
  }

  const historyResult = await db.query(
    `
      SELECT amount, source_type, description, created_at
      FROM xp_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 5
    `,
    [user.id]
  );

  return {
    xp,
    currentLevel,
    nextLevel,
    progressPercent,
    xpIntoLevel,
    xpForLevel,
    xpRemaining: nextLevel ? Math.max(0, nextRequiredXp - xp) : 0,
    isMaxLevel: !nextLevel,
    levels,
    recentTransactions: historyResult.rows,
  };
}

module.exports = {
  getAccountSummary,
  getLevelProgress,
};
