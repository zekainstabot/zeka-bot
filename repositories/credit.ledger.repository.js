const { getClient } = require("../database/client");

function getDb(client = null) {
  return client || getClient();
}

async function create(data, client = null) {
  const db = getDb(client);

  if (!data.userId) {
    throw new Error("User ID is required");
  }

  if (!data.entryType) {
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
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
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

async function findByUserId(
  userId,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT *
      FROM credit_ledger
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
    `,
    [userId]
  );

  return result.rows;
}

async function findByReference(
  referenceType,
  referenceId,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT *
      FROM credit_ledger
      WHERE reference_type = $1
        AND reference_id = $2
      ORDER BY id ASC
    `,
    [referenceType, referenceId]
  );

  return result.rows;
}

module.exports = {
  create,
  findByUserId,
  findByReference,
};
