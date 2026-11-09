const { getPool } = require("../database/pool");
const creditRepository = require("../repositories/credit.repository");
const creditLedgerRepository = require("../repositories/credit.ledger.repository");

async function getOrCreateUser(from) {
  if (!from || !from.id) {
    throw new Error("Telegram user information is required");
  }

  const telegramUserId = String(from.id);
  const displayName = [
    from.first_name,
    from.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Serialize first-time registration for the same Telegram account.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`zeka-user-create:${telegramUserId}`]
    );

    let result = await client.query(
      `
        SELECT *
        FROM users
        WHERE telegram_user_id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [telegramUserId]
    );

    let user = result.rows[0] || null;

    if (user) {
      await client.query("COMMIT");
      return user;
    }

    result = await client.query(
      `
        INSERT INTO users (
          telegram_user_id,
          username,
          display_name,
          language
        )
        VALUES ($1, $2, $3, 'fa')
        RETURNING *
      `,
      [
        telegramUserId,
        from.username || null,
        displayName || null,
      ]
    );

    user = result.rows[0];

    const creditAccount = await creditRepository.create(
      {
        userId: user.id,
        creditType: "DOWNLOAD",
        amount: 12,
        remainingAmount: 12,
        source: "DAILY",
      },
      client
    );

    await creditLedgerRepository.create(
      {
        userId: user.id,
        creditAccountId: creditAccount.id,
        entryType: "CREDIT",
        amount: 12,
        balanceBefore: 0,
        balanceAfter: 12,
        referenceType: "DAILY",
        referenceId: creditAccount.id,
        description: "Initial daily download credits",
      },
      client
    );

    await client.query("COMMIT");
    return user;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("User registration rollback failed:", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getOrCreateUser,
};
