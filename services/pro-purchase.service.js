
const { getClient } = require("../database/client");
const adminManagementRepository = require(
  "../repositories/admin-management.repository"
);

const ALLOWED_DURATIONS = [1, 2, 3, 6, 12];

async function createPurchaseRequest({
  telegramUserId,
  username,
  displayName,
  durationMonths,
}) {
  const duration = Number(durationMonths);

  if (!ALLOWED_DURATIONS.includes(duration)) {
    throw new Error("INVALID_PRO_DURATION");
  }

  const db = getClient();

  const existing = await db.query(
    `
      SELECT *
      FROM pro_purchase_requests
      WHERE telegram_user_id = $1
        AND status = 'PENDING'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [String(telegramUserId)]
  );

  if (existing.rows.length) {
    return {
      request: existing.rows[0],
      alreadyPending: true,
    };
  }

  const result = await db.query(
    `
      INSERT INTO pro_purchase_requests (
        telegram_user_id,
        username,
        display_name,
        duration_months
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [
      String(telegramUserId),
      username || null,
      displayName || null,
      duration,
    ]
  );

  return {
    request: result.rows[0],
    alreadyPending: false,
  };
}

async function getProManagers() {
  return adminManagementRepository
    .getActiveAdminsWithPermission("pro");
}

module.exports = {
  createPurchaseRequest,
  getProManagers,
  ALLOWED_DURATIONS,
};
