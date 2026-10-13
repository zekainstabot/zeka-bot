const { getClient } = require("../database/client");
const creditRepository = require("../repositories/credit.repository");
const creditLedgerRepository = require("../repositories/credit.ledger.repository");

const DAILY_CREDIT_AMOUNT = 12;
const ROLLOVER_CAP = 1.5;
const IRAN_TIMEZONE = "Asia/Tehran";

function calculateRollover(remainingDaily) {
  const remaining = Number(remainingDaily || 0);

  if (!Number.isFinite(remaining) || remaining <= 0) {
    return 0;
  }

  return Math.min(
    ROLLOVER_CAP,
    Number((remaining / 6).toFixed(2))
  );
}

function getIranDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IRAN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

async function getBalanceInTransaction(userId, db) {
  const result = await db.query(
    `
      SELECT COALESCE(SUM(remaining_amount), 0) AS balance
      FROM credit_accounts
      WHERE user_id = $1
        AND remaining_amount > 0
        AND (expires_at IS NULL OR expires_at > NOW())
    `,
    [userId]
  );

  return Number(result.rows[0]?.balance || 0);
}

async function createDailyCreditsForUser(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const pool = getClient();
  const db = await pool.connect();

  try {
    await db.query("BEGIN");

    const userResult = await db.query(
      `
        SELECT id
        FROM users
        WHERE id = $1
        FOR UPDATE
      `,
      [userId]
    );

    if (!userResult.rows.length) {
      throw new Error(`User not found: ${userId}`);
    }

    const todayIran = getIranDateString();

    const dailyResult = await db.query(
      `
        SELECT *
        FROM credit_accounts
        WHERE user_id = $1
          AND UPPER(source) = 'DAILY'
        ORDER BY created_at DESC, id DESC
        FOR UPDATE
      `,
      [userId]
    );

    const dailyAccounts = dailyResult.rows;

    const todayDaily = dailyAccounts.find((account) => {
      return (
        getIranDateString(new Date(account.created_at)) === todayIran
      );
    });

    const previousAccounts = dailyAccounts.filter((account) => {
      return (
        getIranDateString(new Date(account.created_at)) !== todayIran
      );
    });

    if (todayDaily) {
      if (previousAccounts.length > 0) {
        await db.query(
          `
            UPDATE credit_accounts
            SET remaining_amount = 0,
                updated_at = NOW()
            WHERE user_id = $1
              AND UPPER(source) = 'DAILY'
              AND id = ANY($2::bigint[])
          `,
          [userId, previousAccounts.map((account) => account.id)]
        );
      }

      await db.query("COMMIT");

      return {
        created: false,
        reason: "DAILY_CREDIT_ALREADY_CREATED",
        daily: Number(todayDaily.remaining_amount || 0),
        rollover: 0,
        expiredAccounts: previousAccounts.length,
      };
    }

    const latestPreviousDaily = previousAccounts[0] || null;

    const remainingDaily = latestPreviousDaily
      ? Number(latestPreviousDaily.remaining_amount || 0)
      : 0;

    const rollover = calculateRollover(remainingDaily);

    if (previousAccounts.length > 0) {
      await db.query(
        `
          UPDATE credit_accounts
          SET remaining_amount = 0,
              updated_at = NOW()
          WHERE user_id = $1
            AND UPPER(source) = 'DAILY'
            AND id = ANY($2::bigint[])
        `,
        [userId, previousAccounts.map((account) => account.id)]
      );
    }

    if (rollover > 0) {
      const rolloverAccount = await creditRepository.create(
        {
          userId,
          creditType: "DOWNLOAD",
          amount: rollover,
          remainingAmount: rollover,
          source: "ROLLOVER",
          expiresAt: null,
        },
        db
      );

      const balanceAfterRollover = await getBalanceInTransaction(
        userId,
        db
      );

      await creditLedgerRepository.create(
        {
          userId,
          creditAccountId: rolloverAccount.id,
          entryType: "CREDIT",
          amount: rollover,
          balanceBefore: balanceAfterRollover - rollover,
          balanceAfter: balanceAfterRollover,
          referenceType: "ROLLOVER",
          referenceId: rolloverAccount.id,
          description: "Daily rollover credits",
        },
        db
      );
    }

    const balanceBeforeDaily = await getBalanceInTransaction(
      userId,
      db
    );

    const dailyAccount = await creditRepository.create(
      {
        userId,
        creditType: "DOWNLOAD",
        amount: DAILY_CREDIT_AMOUNT,
        remainingAmount: DAILY_CREDIT_AMOUNT,
        source: "DAILY",
        expiresAt: null,
      },
      db
    );

    const balanceAfterDaily = await getBalanceInTransaction(
      userId,
      db
    );

    await creditLedgerRepository.create(
      {
        userId,
        creditAccountId: dailyAccount.id,
        entryType: "CREDIT",
        amount: DAILY_CREDIT_AMOUNT,
        balanceBefore: balanceBeforeDaily,
        balanceAfter: balanceAfterDaily,
        referenceType: "DAILY",
        referenceId: dailyAccount.id,
        description: "Daily download credits",
      },
      db
    );

    await db.query("COMMIT");

    return {
      created: true,
      daily: DAILY_CREDIT_AMOUNT,
      rollover,
      accountId: dailyAccount.id,
      expiredAccounts: previousAccounts.length,
    };
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Daily credit transaction rollback failed:",
        rollbackError
      );
    }

    throw error;
  } finally {
    db.release();
  }
}

module.exports = {
  DAILY_CREDIT_AMOUNT,
  ROLLOVER_CAP,
  calculateRollover,
  getIranDateString,
  createDailyCreditsForUser,
};
