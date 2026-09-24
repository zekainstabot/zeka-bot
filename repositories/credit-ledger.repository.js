const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

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

async function findByUserId(userId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM credit_ledger
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function findByCreditAccountId(
  creditAccountId,
  limit = 100
) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM credit_ledger
      WHERE credit_account_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [creditAccountId, safeLimit]
  );

  return result.rows;
}

async function findByReference(
  referenceType,
  referenceId
) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM credit_ledger
      WHERE reference_type = $1
        AND reference_id = $2
      ORDER BY created_at DESC
    `,
    [referenceType, referenceId]
  );

  return result.rows;
}

module.exports = {
  create,
  findByUserId,
  findByCreditAccountId,
  findByReference,
};
