
const { getPool } = require("../database/pool");
const creditRepository = require("../repositories/credit.repository");
const creditLedgerRepository = require("../repositories/credit.ledger.repository");

function validateAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  if (amount > 1000000) {
    throw new Error("AMOUNT_TOO_LARGE");
  }

  return Number(amount.toFixed(2));
}

async function getBalance(userId) {
  return creditRepository.getAvailableBalance(userId);
}

async function addCredit({
  userId,
  amount,
  adminTelegramId,
  description,
}) {
  const value = validateAmount(amount);

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const balanceBefore =
      await creditRepository.getAvailableBalance(
        userId,
        client
      );

    const account = await creditRepository.create(
      {
        userId,
        creditType: "STANDARD",
        amount: value,
        remainingAmount: value,
        source: "ADMIN",
      },
      client
    );

    const balanceAfter =
      Number(balanceBefore) + value;

    await creditLedgerRepository.create(
      {
        userId,
        creditAccountId: account.id,
        entryType: "ADMIN_ADD",
        amount: value,
        balanceBefore,
        balanceAfter,
        referenceType: "ADMIN",
        description:
          description ||
          `Credit added by admin ${adminTelegramId || "unknown"}`,
      },
      client
    );

    await client.query("COMMIT");

    return {
      account,
      balanceBefore: Number(balanceBefore),
      balanceAfter,
      amount: value,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function removeCredit({
  userId,
  amount,
  adminTelegramId,
  description,
}) {
  const value = validateAmount(amount);

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const accounts =
      await creditRepository.findAvailablePackages(
        userId,
        client
      );

    const balanceBefore = accounts.reduce(
      (total, account) =>
        total + Number(account.remaining_amount),
      0
    );

    if (balanceBefore < value) {
      throw new Error("INSUFFICIENT_CREDIT");
    }

    let remainingToRemove = value;

    for (const account of accounts) {
      if (remainingToRemove <= 0) {
        break;
      }

      const available =
        Number(account.remaining_amount);

      if (available <= 0) {
        continue;
      }

      const deduction = Math.min(
        available,
        remainingToRemove
      );

      const newRemaining =
        Number((available - deduction).toFixed(2));

      await creditRepository.updateRemaining(
        account.id,
        newRemaining,
        client
      );

      await creditLedgerRepository.create(
        {
          userId,
          creditAccountId: account.id,
          entryType: "ADMIN_REMOVE",
          amount: -deduction,
          balanceBefore: available,
          balanceAfter: newRemaining,
          referenceType: "ADMIN",
          description:
            description ||
            `Credit removed by admin ${adminTelegramId || "unknown"}`,
        },
        client
      );

      remainingToRemove = Number(
        (remainingToRemove - deduction).toFixed(2)
      );
    }

    if (remainingToRemove > 0) {
      throw new Error("INSUFFICIENT_CREDIT");
    }

    const balanceAfter =
      Number((balanceBefore - value).toFixed(2));

    await client.query("COMMIT");

    return {
      amount: value,
      balanceBefore,
      balanceAfter,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getHistory(userId, limit = 10) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const pool = getPool();

  const result = await pool.query(
    `
      SELECT
        id,
        entry_type,
        amount,
        balance_before,
        balance_after,
        description,
        created_at
      FROM credit_ledger
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
    `,
    [
      userId,
      Math.min(Math.max(Number(limit) || 10, 1), 50),
    ]
  );

  return result.rows;
}

module.exports = {
  getBalance,
  addCredit,
  removeCredit,
  getHistory,
};
