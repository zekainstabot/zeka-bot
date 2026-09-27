const { getClient } = require("../database/client");
const creditRepository = require("../repositories/credit.repository");
const creditLedgerRepository = require("../repositories/credit.ledger.repository");

const DAILY_CREDIT_AMOUNT = 12;
const ROLLOVER_CAP = 1.5;
const IRAN_TIMEZONE = "Asia/Tehran";

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

function getIranDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IRAN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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

  const db = getClient();

  await db.query("BEGIN");

  try {
    /*
     * Lock the user row first.
     *
     * This prevents two simultaneous requests from both
     * seeing "no Daily credit for today" and creating
     * duplicate Daily credits.
     */
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
      const createdDate = getIranDateString(
        new Date(account.created_at)
      );

      return createdDate === todayIran;
    });

    if (todayDaily) {
      await db.query("COMMIT");

      return {
        created: false,
        reason: "DAILY_CREDIT_ALREADY_CREATED",
        daily: Number(
          todayDaily.remaining_amount || 0
        ),
        rollover: 0,
      };
    }

    const previousDaily = dailyAccounts.find(
      (account) =>
        getIranDateString(
          new Date(account.created_at)
        ) !== todayIran
    );

    let rollover = 0;

    if (previousDaily) {
      const remainingDaily = Number(
        previousDaily.remaining_amount || 0
      );

      rollover = calculateRollover(
        remainingDaily
      );

      await db.query(
        `
          UPDATE credit_accounts
          SET
            remaining_amount = 0,
            updated_at = NOW()
          WHERE id = $1
        `,
        [previousDaily.id]
      );

      if (rollover > 0) {
        const rolloverAccount =
          await creditRepository.create(
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

        const balanceAfterRollover =
          await getBalanceInTransaction(
            userId,
            db
          );

        await creditLedgerRepository.create(
          {
            userId,
            creditAccountId: rolloverAccount.id,
            entryType: "CREDIT",
            amount: rollover,
            balanceBefore:
              balanceAfterRollover - rollover,
            balanceAfter:
              balanceAfterRollover,
            referenceType: "ROLLOVER",
            referenceId: rolloverAccount.id,
            description:
              "Daily rollover credits",
          },
          db
        );
      }
    }

    const balanceBeforeDaily =
      await getBalanceInTransaction(
        userId,
        db
      );

    const dailyAccount =
      await creditRepository.create(
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

    const balanceAfterDaily =
      await getBalanceInTransaction(
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
        description:
          "Daily download credits",
      },
      db
    );

    await db.query("COMMIT");

    return {
      created: true,
      daily: DAILY_CREDIT_AMOUNT,
      rollover,
      accountId: dailyAccount.id,
    };
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

module.exports = {
  DAILY_CREDIT_AMOUNT,
  ROLLOVER_CAP,
  calculateRollover,
  getIranDateString,
  createDailyCreditsForUser,
};
