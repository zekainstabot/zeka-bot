
const crypto = require("crypto");

const { getClient } = require("../database/client");
const adminManagementRepository = require(
  "../repositories/admin-management.repository"
);

const ALLOWED_DURATIONS = [1, 2, 3, 6, 12];

const OPEN_STATUSES = [
  "PENDING",
  "WAITING_RECEIPT",
  "RECEIPT_SUBMITTED",
];

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
        AND status = ANY($2::varchar[])
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [String(telegramUserId), OPEN_STATUSES]
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

async function getPurchaseRequestById(requestId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM pro_purchase_requests
      WHERE id = $1
      LIMIT 1
    `,
    [requestId]
  );

  return result.rows[0] || null;
}

async function getLatestOpenPurchaseRequest(telegramUserId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM pro_purchase_requests
      WHERE telegram_user_id = $1
        AND status = ANY($2::varchar[])
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [String(telegramUserId), OPEN_STATUSES]
  );

  return result.rows[0] || null;
}

async function setPaymentCardNumber({
  requestId,
  cardNumber,
}) {
  const normalizedCardNumber = String(cardNumber || "").trim();

  if (!normalizedCardNumber) {
    throw new Error("INVALID_PAYMENT_CARD_NUMBER");
  }

  const db = getClient();

  const result = await db.query(
    `
      UPDATE pro_purchase_requests
      SET
        payment_card_number = $2,
        status = 'WAITING_RECEIPT',
        updated_at = NOW()
      WHERE id = $1
        AND status = 'PENDING'
      RETURNING *
    `,
    [requestId, normalizedCardNumber]
  );

  return result.rows[0] || null;
}


async function cancelPurchaseRequest(telegramUserId) {
  const db = getClient();

  const result = await db.query(
    `
      WITH target AS (
        SELECT id
        FROM pro_purchase_requests
        WHERE telegram_user_id = $1
          AND status = ANY($2::varchar[])
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      )
      UPDATE pro_purchase_requests
      SET
        status = 'CANCELLED',
        updated_at = NOW()
      WHERE id = (SELECT id FROM target)
        AND telegram_user_id = $1
        AND status = ANY($2::varchar[])
      RETURNING *
    `,
    [String(telegramUserId), OPEN_STATUSES]
  );

  return result.rows[0] || null;
}


async function submitPurchaseReceipt({
  requestId,
  telegramUserId,
  receiptType,
  receiptText,
  receiptFileId,
}) {
  if (!["TEXT", "PHOTO"].includes(receiptType)) {
    throw new Error("INVALID_RECEIPT_TYPE");
  }

  if (receiptType === "TEXT" && !String(receiptText || "").trim()) {
    throw new Error("EMPTY_RECEIPT_TEXT");
  }

  if (receiptType === "PHOTO" && !receiptFileId) {
    throw new Error("MISSING_RECEIPT_FILE_ID");
  }

  const db = getClient();

  const result = await db.query(
    `
      UPDATE pro_purchase_requests
      SET
        status = 'RECEIPT_SUBMITTED',
        receipt_type = $3,
        receipt_text = $4,
        receipt_file_id = $5,
        receipt_submitted_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
        AND telegram_user_id = $2
        AND status = 'WAITING_RECEIPT'
      RETURNING *
    `,
    [
      requestId,
      String(telegramUserId),
      receiptType,
      receiptType === "TEXT" ? String(receiptText).trim() : null,
      receiptType === "PHOTO" ? receiptFileId : null,
    ]
  );

  return result.rows[0] || null;
}

function addMonths(date, months) {
  const result = new Date(date);
  const originalDay = result.getUTCDate();

  result.setUTCMonth(result.getUTCMonth() + months);

  if (result.getUTCDate() !== originalDay) {
    result.setUTCDate(0);
  }

  return result;
}

async function reviewPurchaseRequest({
  requestId,
  reviewerTelegramUserId,
  decision,
}) {
  if (!["APPROVED", "REJECTED"].includes(decision)) {
    throw new Error("INVALID_PURCHASE_DECISION");
  }

  const db = getClient();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      `
        SELECT *
        FROM pro_purchase_requests
        WHERE id = $1
        FOR UPDATE
      `,
      [requestId]
    );

    const request = requestResult.rows[0];

    if (!request) {
      await client.query("ROLLBACK");
      return { success: false, reason: "NOT_FOUND" };
    }

    if (request.status !== "RECEIPT_SUBMITTED") {
      await client.query("ROLLBACK");
      return { success: false, reason: "ALREADY_REVIEWED" };
    }

    if (decision === "APPROVED") {
      const userResult = await client.query(
        `
          SELECT *
          FROM users
          WHERE telegram_user_id = $1
          FOR UPDATE
        `,
        [String(request.telegram_user_id)]
      );

      const user = userResult.rows[0];

      if (!user) {
        throw new Error("PRO_PURCHASE_USER_NOT_FOUND");
      }

      const now = new Date();
      const currentExpiry = user.pro_expires_at
        ? new Date(user.pro_expires_at)
        : null;

      const startsAt =
        currentExpiry && currentExpiry > now
          ? currentExpiry
          : now;

      const expiresAt = addMonths(
        startsAt,
        Number(request.duration_months)
      );

      const subscriptionId =
        "PRO-PURCHASE-" +
        Date.now() +
        "-" +
        crypto.randomBytes(4).toString("hex");

      await client.query(
        `
          INSERT INTO pro_subscriptions (
            user_id,
            subscription_id,
            plan_type,
            duration_months,
            status,
            starts_at,
            expires_at,
            source_type,
            source_id,
            price,
            currency,
            metadata
          )
          VALUES (
            $1, $2, $3, $4, 'ACTIVE',
            $5, $6, 'PURCHASE', $7, 0, 'IRT', $8
          )
        `,
        [
          user.id,
          subscriptionId,
          `PURCHASE_${request.duration_months}M`,
          request.duration_months,
          startsAt,
          expiresAt,
          String(reviewerTelegramUserId),
          JSON.stringify({
            purchase_request_id: String(request.id),
            reviewer_telegram_user_id: String(reviewerTelegramUserId),
          }),
        ]
      );

      await client.query(
        `
          UPDATE users
          SET
            is_pro = TRUE,
            pro_expires_at = $2,
            updated_at = NOW()
          WHERE id = $1
        `,
        [user.id, expiresAt]
      );
    }

    const updateResult = await client.query(
      `
        UPDATE pro_purchase_requests
        SET
          status = $2,
          reviewed_by = $3,
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
          AND status = 'RECEIPT_SUBMITTED'
        RETURNING *
      `,
      [
        requestId,
        decision,
        String(reviewerTelegramUserId),
      ]
    );

    if (!updateResult.rows.length) {
      throw new Error("PRO_PURCHASE_REVIEW_UPDATE_FAILED");
    }

    await client.query("COMMIT");

    return {
      success: true,
      request: updateResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createPurchaseRequest,
  getProManagers,
  getPurchaseRequestById,
  getLatestOpenPurchaseRequest,
  cancelPurchaseRequest,
  setPaymentCardNumber,
  submitPurchaseReceipt,
  reviewPurchaseRequest,
  ALLOWED_DURATIONS,
};
