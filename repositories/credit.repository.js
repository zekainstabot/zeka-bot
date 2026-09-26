const { getClient } = require("../database/client");

function getDb(client = null) {
  return client || getClient();
}

async function findByUserId(userId, client = null) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT *
      FROM credit_accounts
      WHERE user_id = $1
      ORDER BY expires_at ASC NULLS LAST,
               created_at ASC
    `,
    [userId]
  );

  return result.rows;
}

async function getAvailableBalance(userId, client = null) {
  const db = getDb(client);

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

async function findAvailablePackages(userId, client = null) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT *
      FROM credit_accounts
      WHERE user_id = $1
        AND remaining_amount > 0
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY expires_at ASC NULLS LAST,
               amount DESC,
               created_at ASC
      FOR UPDATE
    `,
    [userId]
  );

  return result.rows;
}

async function findByIdForUpdate(id, client = null) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT *
      FROM credit_accounts
      WHERE id = $1
      FOR UPDATE
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function create(data, client = null) {
  const db = getDb(client);

  if (!data.userId) {
    throw new Error("User ID is required");
  }

  if (!data.creditType) {
    throw new Error("Credit type is required");
  }

  if (data.amount === undefined) {
    throw new Error("Credit amount is required");
  }

  const result = await db.query(
    `
      INSERT INTO credit_accounts (
        user_id,
        credit_type,
        amount,
        remaining_amount,
        source,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      data.userId,
      data.creditType,
      data.amount,
      data.remainingAmount ?? data.amount,
      data.source || "SYSTEM",
      data.expiresAt || null,
    ]
  );

  return result.rows[0];
}

async function updateRemaining(
  id,
  remainingAmount,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
    `
      UPDATE credit_accounts
      SET
        remaining_amount = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, remainingAmount]
  );

  return result.rows[0] || null;
}

async function createLedgerEntry(data, client = null) {
  const db = getDb(client);

  if (!data.userId) {
    throw new Error("User ID is required");
  }

  if (data.entryType === undefined) {
    throw new Error("Ledger entry type is required");
  }

  if (data.amount === undefined) {
    throw new Error("Ledger amount is required");
  }

  const result = await db.query(
    `
      INSERT INTO credit_ledger (
        user_id,
        credit_account_id,
        entry_type,
        amount,
        balance_before,
        balance_after,
        reference_type,
        reference_id,
        description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      data.userId,
      data.creditAccountId || null,
      data.entryType,
      data.amount,
      data.balanceBefore ?? null,
      data.balanceAfter ?? null,
      data.referenceType || null,
      data.referenceId || null,
      data.description || null,
    ]
  );

  return result.rows[0];
}

async function findLedgerByUserId(
  userId,
  options = {},
  client = null
) {
  const db = getDb(client);

  const limit = Math.min(
    Math.max(Number(options.limit) || 100, 1),
    500
  );

  const result = await db.query(
    `
      SELECT *
      FROM credit_ledger
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
    `,
    [userId, limit]
  );

  return result.rows;
}

async function createReservation(data, client = null) {
  const db = getDb(client);

  if (!data.userId) {
    throw new Error("User ID is required");
  }

  if (!data.creditAccountId) {
    throw new Error("Credit account ID is required");
  }

  if (data.amount === undefined) {
    throw new Error("Reservation amount is required");
  }

  const result = await db.query(
    `
      INSERT INTO credit_reservations (
        user_id,
        credit_account_id,
        request_id,
        job_id,
        amount,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'RESERVED')
      RETURNING *
    `,
    [
      data.userId,
      data.creditAccountId,
      data.requestId || null,
      data.jobId || null,
      data.amount,
    ]
  );

  return result.rows[0];
}

async function findReservationByIdForUpdate(
  id,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT *
      FROM credit_reservations
      WHERE id = $1
      FOR UPDATE
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findActiveReservations(
  userId,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT *
      FROM credit_reservations
      WHERE user_id = $1
        AND status = 'RESERVED'
      ORDER BY reserved_at ASC, id ASC
      FOR UPDATE
    `,
    [userId]
  );

  return result.rows;
}

async function markReservationConsumed(
  id,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
    `
      UPDATE credit_reservations
      SET
        status = 'CONSUMED',
        consumed_at = NOW()
      WHERE id = $1
        AND status = 'RESERVED'
      RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function markReservationReleased(
  id,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
    `
      UPDATE credit_reservations
      SET
        status = 'RELEASED',
        released_at = NOW()
      WHERE id = $1
        AND status = 'RESERVED'
      RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}

module.exports = {
  findByUserId,
  getAvailableBalance,
  findAvailablePackages,
  findByIdForUpdate,
  create,
  updateRemaining,

  createLedgerEntry,
  findLedgerByUserId,

  createReservation,
  findReservationByIdForUpdate,
  findActiveReservations,
  markReservationConsumed,
  markReservationReleased,
};
