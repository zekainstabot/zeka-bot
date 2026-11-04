
const { getClient } = require("../database/client");

async function getLatestTransactions(limit = 10) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 10, 50)
  );

  const result = await db.query(
    `
      SELECT
        pt.id AS transaction_db_id,
        pt.transaction_id,
        pt.transaction_type,
        pt.status AS transaction_status,
        pt.amount AS transaction_amount,
        pt.currency AS transaction_currency,
        pt.reference_number,
        pt.verified_at,
        pt.created_at AS transaction_created_at,

        p.payment_id,
        p.payment_type,
        p.provider,
        p.status AS payment_status,
        p.amount AS payment_amount,
        p.currency AS payment_currency,
        p.paid_at,

        u.telegram_user_id,
        u.username,
        u.display_name

      FROM payment_transactions pt

      INNER JOIN payments p
        ON p.id = pt.payment_id

      INNER JOIN users u
        ON u.id = p.user_id

      ORDER BY
        pt.created_at DESC,
        pt.id DESC

      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function getTransactionCount() {
  const db = getClient();

  const result = await db.query(
    `
      SELECT COUNT(*)::BIGINT AS total
      FROM payment_transactions
    `
  );

  return Number(result.rows[0]?.total || 0);
}

module.exports = {
  getLatestTransactions,
  getTransactionCount,
};
