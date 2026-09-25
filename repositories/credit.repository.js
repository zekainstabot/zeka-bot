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
      ORDER BY expires_at ASC NULLS LAST, created_at ASC
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

module.exports = {
  findByUserId,
  getAvailableBalance,
  findAvailablePackages,
  create,
  updateRemaining,
};
