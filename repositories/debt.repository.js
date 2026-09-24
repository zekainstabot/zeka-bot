const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO debts (
        user_id,
        request_id,
        job_id,
        original_amount,
        multiplier,
        amount_due,
        amount_paid,
        status,
        due_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      data.userId,
      data.requestId || null,
      data.jobId || null,
      data.originalAmount,
      data.multiplier ?? 1,
      data.amountDue,
      data.amountPaid ?? 0,
      data.status || "ACTIVE",
      data.dueAt || null,
    ]
  );

  return result.rows[0];
}

async function findById(id) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM debts
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
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
      FROM debts
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function findActiveByUserId(userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM debts
      WHERE user_id = $1
        AND status = 'ACTIVE'
      ORDER BY created_at ASC
    `,
    [userId]
  );

  return result.rows;
}

async function updateById(id, updates) {
  const db = getClient();

  const allowedFields = [
    "original_amount",
    "multiplier",
    "amount_due",
    "amount_paid",
    "status",
    "due_at",
    "paid_at",
  ];

  const entries = Object.entries(updates).filter(([field]) =>
    allowedFields.includes(field)
  );

  if (entries.length === 0) {
    return findById(id);
  }

  const values = entries.map(([, value]) => value);

  const setClause = entries
    .map(([field], index) => `${field} = $${index + 2}`)
    .join(", ");

  const result = await db.query(
    `
      UPDATE debts
      SET ${setClause},
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

async function markPaid(id, amountPaid = null) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE debts
      SET
        amount_paid = COALESCE($2, amount_due),
        status = 'PAID',
        paid_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, amountPaid]
  );

  return result.rows[0] || null;
}

async function deleteById(id) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM debts
      WHERE id = $1
    `,
    [id]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findByUserId,
  findActiveByUserId,
  updateById,
  markPaid,
  deleteById,
};
