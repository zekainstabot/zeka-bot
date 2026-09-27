const creditRepository = require("../repositories/credit.repository");

const DAILY_CREDIT_AMOUNT = 12;
const ROLLOVER_CAP = 1.5;

function calculateRollover(remainingDaily) {
  const remaining = Number(remainingDaily || 0);

  if (remaining <= 0) {
    return 0;
  }

  const rollover = remaining / 6;

  return Math.min(
    ROLLOVER_CAP,
    Number(rollover.toFixed(2))
  );
}

async function createDailyCreditsForUser(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const accounts =
    await creditRepository.findByUserId(userId);

  const now = new Date();

  const dailyAccounts = accounts.filter((account) => {
    return (
      String(account.source || "").toUpperCase() === "DAILY" &&
      Number(account.remaining_amount || 0) > 0
    );
  });

  const activeDailyAccounts = dailyAccounts.filter((account) => {
    if (!account.expires_at) {
      return true;
    }

    return new Date(account.expires_at) > now;
  });

  /*
   * اگر اعتبار روزانه فعال هنوز وجود دارد،
   * اعتبار روزانه جدید ایجاد نمی‌کنیم.
   */
  if (activeDailyAccounts.length > 0) {
    const existingDaily = activeDailyAccounts.reduce(
      (total, account) =>
        total + Number(account.remaining_amount || 0),
      0
    );

    return {
      created: false,
      reason: "DAILY_CREDIT_ALREADY_EXISTS",
      daily: Number(existingDaily.toFixed(2)),
      rollover: 0,
    };
  }

  /*
   * آخرین اعتبار روزانه مصرف‌نشده را پیدا می‌کنیم.
   * این مقدار همان چیزی است که باید تبدیل به rollover شود.
   */
  const remainingDaily = dailyAccounts.reduce(
    (total, account) =>
      total + Number(account.remaining_amount || 0),
    0
  );

  const rollover = calculateRollover(remainingDaily);

  if (rollover > 0) {
    await creditRepository.create({
      userId,
      creditType: "ROLLOVER",
      amount: rollover,
      remainingAmount: rollover,
      source: "ROLLOVER",
      expiresAt: null,
    });
  }

  /*
   * اعتبار روزانه جدید برای چرخه جدید.
   */
  const expiresAt = new Date(
    now.getTime() + 24 * 60 * 60 * 1000
  );

  await creditRepository.create({
    userId,
    creditType: "DAILY",
    amount: DAILY_CREDIT_AMOUNT,
    remainingAmount: DAILY_CREDIT_AMOUNT,
    source: "DAILY",
    expiresAt,
  });

  return {
    created: true,
    daily: DAILY_CREDIT_AMOUNT,
    rollover,
  };
}

module.exports = {
  DAILY_CREDIT_AMOUNT,
  ROLLOVER_CAP,
  calculateRollover,
  createDailyCreditsForUser,
};
