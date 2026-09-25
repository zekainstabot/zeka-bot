const creditRepository = require("../repositories/credit.repository");
const creditReservationRepository = require("../repositories/credit.reservation.repository");
const { getPool } = require("../database/pool");

async function reserveCredit({
  userId,
  amount = 1,
  requestId = null,
  jobId = null,
}) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  if (amount <= 0) {
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

    let remainingToReserve = Number(amount);
    const reservations = [];

    for (const account of accounts) {
      if (remainingToReserve <= 0) {
        break;
      }

      const available =
        Number(account.remaining_amount);

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
        client
      );

      const reservation =
        await creditReservationRepository.create(
          {
            userId,
            creditAccountId: account.id,
            requestId,
            jobId,
            amount: reservedFromAccount,
          },
          client
        );

      reservations.push(reservation);

      remainingToReserve -= reservedFromAccount;
    }

    if (remainingToReserve > 0) {
      throw new Error("Insufficient credit");
    }

    await client.query("COMMIT");

    return reservations;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function consumeCredit(jobId) {
  if (!jobId) {
    throw new Error("Job ID is required");
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reservations =
      await creditReservationRepository.findActiveByJobId(
        jobId,
        client
      );

    if (!reservations.length) {
      throw new Error(
        `No active credit reservation found for job: ${jobId}`
      );
    }

    const consumed = [];

    for (const reservation of reservations) {
      const result =
        await creditReservationRepository.markConsumed(
          reservation.id,
          client
        );

      if (result) {
        consumed.push(result);
      }
    }

    await client.query("COMMIT");

    return consumed;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function releaseCredit(jobId) {
  if (!jobId) {
    throw new Error("Job ID is required");
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reservations =
      await creditReservationRepository.findActiveByJobId(
        jobId,
        client
      );

    if (!reservations.length) {
      await client.query("COMMIT");
      return [];
    }

    const released = [];

    for (const reservation of reservations) {
      const amount = Number(reservation.amount);

      const account =
        await creditRepository.findByUserId(
          reservation.user_id,
          client
        );

      const targetAccount = account.find(
        (item) =>
          Number(item.id) ===
          Number(reservation.credit_account_id)
      );

      if (!targetAccount) {
        throw new Error(
          `Credit account not found: ${reservation.credit_account_id}`
        );
      }

      const newRemaining =
        Number(targetAccount.remaining_amount) +
        amount;

      await creditRepository.updateRemaining(
        targetAccount.id,
        newRemaining,
        client
      );

      const result =
        await creditReservationRepository.markReleased(
          reservation.id,
          client
        );

      if (result) {
        released.push(result);
      }
    }

    await client.query("COMMIT");

    return released;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getBalance(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  return creditRepository.getAvailableBalance(userId);
}

module.exports = {
  reserveCredit,
  consumeCredit,
  releaseCredit,
  getBalance,
};
