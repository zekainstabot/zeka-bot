const { getPool } = require("../database/pool");
const creditRepository = require("../repositories/credit.repository");
const creditLedgerRepository = require("../repositories/credit.ledger.repository");
const { isActivePro } = require("./pro.service");

const FORTUNE_COSTS = Object.freeze({
  hafez: 0.5,
  love: 0.7,
  daily: 0.3,
  money: 0.7,
  intention: 0.5,
});

function roundCredit(value) {
  return Number(Number(value).toFixed(2));
}

async function deductFortuneCredit({ userId, slug }) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const cost = FORTUNE_COSTS[slug];
  if (!Number.isFinite(cost) || cost <= 0) {
    throw new Error("Invalid fortune category");
  }

  if (await isActivePro(userId)) {
    return {
      isPro: true,
      cost: 0,
      balance: await creditRepository.getAvailableBalance(userId),
    };
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const accounts = await creditRepository.findAvailablePackages(
      userId,
      client
    );

    const balance = roundCredit(
      accounts.reduce(
        (total, account) => total + Number(account.remaining_amount || 0),
        0
      )
    );

    if (balance + 0.000001 < cost) {
      const error = new Error("Insufficient credit");
      error.code = "INSUFFICIENT_CREDIT";
      error.cost = cost;
      error.balance = balance;
      throw error;
    }

    let remainingToDeduct = cost;

    for (const account of accounts) {
      if (remainingToDeduct <= 0.000001) {
        break;
      }

      const before = roundCredit(account.remaining_amount);
      if (before <= 0) continue;

      const deducted = roundCredit(
        Math.min(before, remainingToDeduct)
      );
      const after = roundCredit(before - deducted);

      await creditRepository.updateRemaining(
        account.id,
        after,
        client
      );

      await creditLedgerRepository.create(
        {
          userId,
          creditAccountId: account.id,
          entryType: "CONSUME",
          amount: -deducted,
          balanceBefore: before,
          balanceAfter: after,
          referenceType: "FORTUNE",
          description: `Fortune request: ${slug}`,
        },
        client
      );

      remainingToDeduct = roundCredit(
        remainingToDeduct - deducted
      );
    }

    if (remainingToDeduct > 0.000001) {
      throw new Error("Credit balance changed during fortune charge");
    }

    await client.query("COMMIT");

    return {
      isPro: false,
      cost,
      balance: roundCredit(balance - cost),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  FORTUNE_COSTS,
  deductFortuneCredit,
};
