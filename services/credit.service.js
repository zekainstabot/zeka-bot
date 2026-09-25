const creditRepository = require("../repositories/credit.repository");
const { getPool } = require("../database/pool");

async function reserveCredit(userId, amount = 1, client = null) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  if (amount <= 0) {
    throw new Error("Credit amount must be greater than zero");
  }

  const db = client || getPool();

  const accounts = await creditRepository.findAvailablePackages(
    userId,
    db
  );

  let remainingToReserve = Number(amount);
  const reservations = [];

  for (const account of accounts) {
    if (remainingToReserve <= 0) {
      break;
    }

    const available = Number(account.remaining_amount);

    if (available <= 0) {
      continue;
    }

    const reservedFromAccount = Math.min(
      available,
      remainingToReserve
    );

    const newRemaining =
      available - reservedFromAccount;

    await creditRepository.updateRemaining(
      account.id,
      newRemaining,
      db
    );

    reservations.push({
      creditAccountId: account.id,
      amount: reservedFromAccount,
    });

    remainingToReserve -= reservedFromAccount;
  }

  if (remainingToReserve > 0) {
    throw new Error("Insufficient credit");
  }

  return reservations;
}

async function getBalance(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  return creditRepository.getAvailableBalance(userId);
}

module.exports = {
  reserveCredit,
  getBalance,
};
