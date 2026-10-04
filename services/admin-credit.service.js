const { getPool } = require("../database/pool");
const creditRepository = require("../repositories/credit.repository");
const creditLedgerRepository = require("../repositories/credit.ledger.repository");

async function addCredits({
  userId,
  amount,
  description = "Credit added by admin",
}) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Credit amount must be greater than zero");
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

    const account =
      await creditRepository.create(
        {
          userId,
          creditType: "BONUS",
          amount: value,
          remainingAmount: value,
          source: "ADMIN",
          expiresAt: null,
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
        referenceId: null,
        description,
      },
      client
    );

    await client.query("COMMIT");

    return {
      account,
      balanceBefore: Number(balanceBefore),
      balanceAfter,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function removeCredits({
  userId,
  amount,
  description = "Credit removed by admin",
}) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Credit amount must be greater than zero");
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

    const balanceBefore =
      accounts.reduce(
        (sum, account) =>
          sum + Number(account.remaining_amount),
        0
      );

    if (balanceBefore < value) {
      throw new Error(
        `Insufficient credit: ${balanceBefore}`
      );
    }

    let remainingToRemove = value;
    const changes = [];

    for (const account of accounts) {
      if (remainingToRemove <= 0) {
        break;
      }

      const available =
        Number(account.remaining_amount);

      if (available <= 0) {
        continue;
      }

      const removed =
        Math.min(
          available,
          remainingToRemove
        );

      const newRemaining =
        available - removed;

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
          amount: -removed,
          balanceBefore: available,
          balanceAfter: newRemaining,
          referenceType: "ADMIN",
          referenceId: null,
          description,
        },
        client
      );

      changes.push({
        accountId: account.id,
        amount: removed,
      });

      remainingToRemove -= removed;
    }

    if (remainingToRemove > 0) {
      throw new Error(
        "Credit removal could not be completed"
      );
    }

    const balanceAfter =
      Number(balanceBefore) - value;

    await client.query("COMMIT");

    return {
      amount: value,
      balanceBefore: Number(balanceBefore),
      balanceAfter,
      changes,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  addCredits,
  removeCredits,
};
