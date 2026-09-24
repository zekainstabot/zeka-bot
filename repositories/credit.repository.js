
const { getClient } = require("../database/client");

async function findByUserId(userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM credits
      WHERE user_id = $1
      ORDER BY expires_at ASC NULLS LAST, created_at ASC
    `,
    [userId]
  );

  return result.rows;
}

async function getAvailableBalance(userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT COALESCE(SUM(remaining_amount), 0) AS balance
      FROM credits
      WHERE user_id = $1
        AND remaining_amount > 0
        AND (expires_at IS NULL OR expires_at > NOW())
    `,
    [userId]
  );

  return Number(result.rows[0]?.balance || 0);
}

async function findAvailablePackages(userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM credits
      WHERE user_id = $1
        AND remaining_amount > 0
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY
        expires_at ASC NULLS LAST,
        amount DESC,
        created_at ASC
    `,
    [userId]
  );

  return result.rows;
}

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO credits (
        user_id,
        amount,
        remaining_amount,
        source,
        expires_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      data.userId,
      data.amount,
      data.remainingAmount ?? data.amount,
      data.source || "SYSTEM",
      data.expiresAt || null,
      data.metadata || null,
    ]
  );

  return result.rows[0];
}

async function updateRemaining(id, remainingAmount) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE credits
      SET remaining_amount = $2,
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
