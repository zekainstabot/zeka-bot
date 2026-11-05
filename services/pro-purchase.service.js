const crypto = require("crypto");

const { getClient } = require("../database/client");

const adminManagementRepository = require(
  "../repositories/admin-management.repository"
);

const adminService = require("./admin.service");
const userRepository = require("../repositories/user.repository");
const adminActionLogService = require("./admin-action-log.service");

const {
  ALLOWED_DURATIONS,
  PLAN_DISCOUNTS,
  validateDuration,
} = require("./pro-pricing.service");

const {
  validateTelegramUserId,
} = require("./pro-coupon.service");

const OPEN_STATUSES = [
  "PENDING",
  "WAITING_RECEIPT",
  "RECEIPT_SUBMITTED",
];

const MAX_BIGINT = "9223372036854775807";

function createError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function validateBigIntId(value, errorCode = "INVALID_ID") {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    throw createError(errorCode);
  }

  if (
    typeof value === "number" &&
    !Number.isSafeInteger(value)
  ) {
    throw createError(errorCode);
  }

  let normalized = String(value).trim();

  if (!/^\d+$/.test(normalized)) {
    throw createError(errorCode);
  }

  normalized = normalized.replace(/^0+(?=\d)/, "");

  if (
    normalized === "0" ||
    normalized.length > MAX_BIGINT.length ||
    (
      normalized.length === MAX_BIGINT.length &&
      normalized > MAX_BIGINT
    )
  ) {
    throw createError(errorCode);
  }

  return normalized;
}

function validatePurchaseRequestId(requestId) {
  return validateBigIntId(
    requestId,
    "INVALID_PURCHASE_REQUEST_ID"
  );
}

function validateUserId(telegramUserId) {
  return validateTelegramUserId(telegramUserId);
}

function validateReviewerId(reviewerTelegramUserId) {
  return validateTelegramUserId(
    reviewerTelegramUserId
  );
}

function validatePagination(limit, offset) {
  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);

  const safeLimit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(Math.floor(parsedLimit), 100))
    : 5;

  const safeOffset =
    Number.isSafeInteger(parsedOffset) &&
    parsedOffset >= 0
      ? parsedOffset
      : 0;

  return {
    limit: safeLimit,
    offset: safeOffset,
  };
}

// مسیر قدیمی خرید بدون قیمت غیرفعال است.
// ثبت درخواست باید فقط از مسیر checkout قیمت‌گذاری‌شده انجام شود.
async function createPurchaseRequest() {
  throw createError("PRICED_CHECKOUT_REQUIRED");
}

async function getProManagers() {
  return adminManagementRepository
    .getActiveAdminsWithPermission("pro");
}

async function getPurchaseRequests({
  status = null,
  limit = 5,
  offset = 0,
} = {}) {
  const allowedStatuses = [
    ...OPEN_STATUSES,
    "APPROVED",
    "REJECTED",
    "CANCELLED",
  ];

  if (
    status !== null &&
    !allowedStatuses.includes(status)
  ) {
    throw createError("INVALID_PURCHASE_STATUS");
  }

  const db = getClient();

  const statuses = status
    ? [status]
    : OPEN_STATUSES;

  const pagination = validatePagination(
    limit,
    offset
  );

  const result = await db.query(
    `
      SELECT *
      FROM pro_purchase_requests
      WHERE status = ANY($1::varchar[])
      ORDER BY
        CASE
          WHEN status = 'RECEIPT_SUBMITTED' THEN 0
          WHEN status = 'PENDING' THEN 1
          WHEN status = 'WAITING_RECEIPT' THEN 2
          ELSE 3
        END,
        created_at DESC,
        id DESC
      LIMIT $2
      OFFSET $3
    `,
    [
      statuses,
      pagination.limit,
      pagination.offset,
    ]
  );

  return result.rows;
}

async function getPurchaseRequestById(requestId) {
  const safeRequestId =
    validatePurchaseRequestId(requestId);

  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM pro_purchase_requests
      WHERE id = $1
      LIMIT 1
    `,
    [safeRequestId]
  );

  return result.rows[0] || null;
}

async function getLatestOpenPurchaseRequest(telegramUserId) {
  const normalizedTelegramId =
    validateUserId(telegramUserId);

  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM pro_purchase_requests
      WHERE telegram_user_id = $1
        AND status = ANY($2::varchar[])
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [
      normalizedTelegramId,
      OPEN_STATUSES,
    ]
  );

  return result.rows[0] || null;
}

async function setPaymentCardNumber({
  requestId,
  cardNumber,
}) {
  const safeRequestId =
    validatePurchaseRequestId(requestId);

  const normalizedCardNumber =
    String(cardNumber || "").trim();

  if (!normalizedCardNumber) {
    throw createError("INVALID_PAYMENT_CARD_NUMBER");
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
    [
      safeRequestId,
      normalizedCardNumber,
    ]
  );

  return result.rows[0] || null;
}

/**
 * مصرف کد تخفیف یک درخواست را آزاد می‌کند.
 * این تابع باید داخل transaction فراخوانی شود.
 */
async function releaseCouponRedemption(
  client,
  purchaseRequestId
) {
  const safeRequestId =
    validatePurchaseRequestId(purchaseRequestId);

  const couponResult = await client.query(
    `
      SELECT coupon.id
      FROM pro_discount_coupons coupon
      INNER JOIN pro_discount_redemptions redemption
        ON redemption.coupon_id = coupon.id
      WHERE redemption.purchase_request_id = $1
      FOR UPDATE OF coupon
    `,
    [safeRequestId]
  );

  if (!couponResult.rows.length) {
    return false;
  }

  const couponId = couponResult.rows[0].id;

  const deleteResult = await client.query(
    `
      DELETE FROM pro_discount_redemptions
      WHERE purchase_request_id = $1
        AND coupon_id = $2
      RETURNING id
    `,
    [
      safeRequestId,
      couponId,
    ]
  );

  if (!deleteResult.rows.length) {
    return false;
  }

  await client.query(
    `
      UPDATE pro_discount_coupons
      SET
        usage_count = GREATEST(usage_count - 1, 0),
        updated_at = NOW()
      WHERE id = $1
    `,
    [couponId]
  );

  return true;
}

async function cancelPurchaseRequest(telegramUserId) {
  const normalizedTelegramId =
    validateUserId(telegramUserId);

  const db = getClient();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`pro-purchase-user:${normalizedTelegramId}`]
    );

    const targetResult = await client.query(
      `
        SELECT *
        FROM pro_purchase_requests
        WHERE telegram_user_id = $1
          AND status = ANY($2::varchar[])
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [
        normalizedTelegramId,
        OPEN_STATUSES,
      ]
    );

    const request = targetResult.rows[0];

    if (!request) {
      await client.query("COMMIT");
      return null;
    }

    const updateResult = await client.query(
      `
        UPDATE pro_purchase_requests
        SET
          status = 'CANCELLED',
          updated_at = NOW()
        WHERE id = $1
          AND status = ANY($2::varchar[])
        RETURNING *
      `,
      [
        request.id,
        OPEN_STATUSES,
      ]
    );

    const cancelledRequest = updateResult.rows[0];

    if (!cancelledRequest) {
      await client.query("COMMIT");
      return null;
    }

    await releaseCouponRedemption(
      client,
      cancelledRequest.id
    );

    await client.query("COMMIT");

    return cancelledRequest;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Cancelling Pro purchase rollback failed:",
        rollbackError
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

async function submitPurchaseReceipt({
  requestId,
  telegramUserId,
  receiptType,
  receiptText,
  receiptFileId,
}) {
  const safeRequestId =
    validatePurchaseRequestId(requestId);

  const normalizedTelegramId =
    validateUserId(telegramUserId);

  if (!["TEXT", "PHOTO"].includes(receiptType)) {
    throw createError("INVALID_RECEIPT_TYPE");
  }

  const normalizedReceiptText =
    receiptType === "TEXT"
      ? String(receiptText || "").trim()
      : null;

  const normalizedFileId =
    receiptType === "PHOTO"
      ? String(receiptFileId || "").trim()
      : null;

  if (
    receiptType === "TEXT" &&
    !normalizedReceiptText
  ) {
    throw createError("EMPTY_RECEIPT_TEXT");
  }

  if (
    receiptType === "PHOTO" &&
    !normalizedFileId
  ) {
    throw createError("MISSING_RECEIPT_FILE_ID");
  }

  const db = getClient();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const receiptIdentifier =
      receiptType === "PHOTO"
        ? normalizedFileId
        : normalizedReceiptText;

    const lockKey = crypto
      .createHash("sha256")
      .update(
        `pro-purchase-receipt:${receiptType}:${receiptIdentifier}`
      )
      .digest("hex");

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [lockKey]
    );

    let duplicateQuery;
    let duplicateParams;

    if (receiptType === "PHOTO") {
      duplicateQuery = `
        SELECT id
        FROM pro_purchase_requests
        WHERE receipt_type = 'PHOTO'
          AND receipt_file_id = $1
        LIMIT 1
      `;

      duplicateParams = [normalizedFileId];
    } else {
      duplicateQuery = `
        SELECT id
        FROM pro_purchase_requests
        WHERE receipt_type = 'TEXT'
          AND receipt_text = $1
        LIMIT 1
      `;

      duplicateParams = [normalizedReceiptText];
    }

    const duplicateResult = await client.query(
      duplicateQuery,
      duplicateParams
    );

    if (duplicateResult.rows.length) {
      const duplicateId =
        String(duplicateResult.rows[0].id);

      if (duplicateId !== safeRequestId) {
        throw createError("DUPLICATE_RECEIPT");
      }
    }

    const result = await client.query(
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
        safeRequestId,
        normalizedTelegramId,
        receiptType,
        normalizedReceiptText,
        normalizedFileId,
      ]
    );

    await client.query("COMMIT");

    return result.rows[0] || null;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Submitting Pro receipt rollback failed:",
        rollbackError
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

function addMonths(date, months) {
  const safeMonths = validateDuration(months);

  const result = new Date(date);
  const originalDay = result.getUTCDate();

  result.setUTCMonth(
    result.getUTCMonth() + safeMonths
  );

  if (result.getUTCDate() !== originalDay) {
    result.setUTCDate(0);
  }

  return result;
}

/**
 * Snapshot قیمت درخواست را قبل از فعال‌سازی اشتراک
 * دوباره اعتبارسنجی می‌کند.
 */
function validatePurchasePriceSnapshot(request) {
  const durationMonths = Number(
    request.duration_months
  );

  if (!ALLOWED_DURATIONS.includes(durationMonths)) {
    return false;
  }

  const basePrice = Number(
    request.base_price_amount
  );

  const finalPrice = Number(
    request.price_amount
  );

  const planDiscount = Number(
    request.plan_discount_percent
  );

  const extraDiscount = Number(
    request.extra_discount_percent
  );

  const couponDiscount = Number(
    request.coupon_discount_percent
  );

  const appliedDiscount = Number(
    request.applied_discount_percent
  );

  if (
    !Number.isSafeInteger(basePrice) ||
    basePrice < 1 ||
    !Number.isSafeInteger(finalPrice) ||
    finalPrice < 1
  ) {
    return false;
  }

  if (
    !Number.isInteger(planDiscount) ||
    !Number.isInteger(extraDiscount) ||
    !Number.isInteger(couponDiscount) ||
    !Number.isInteger(appliedDiscount)
  ) {
    return false;
  }

  if (
    planDiscount < 0 ||
    planDiscount > 90 ||
    extraDiscount < 0 ||
    extraDiscount > 90 ||
    couponDiscount < 0 ||
    couponDiscount > 90 ||
    appliedDiscount < 0 ||
    appliedDiscount > 90
  ) {
    return false;
  }

  // درصد تخفیف پلن باید با مدت اشتراک مطابقت داشته باشد.
  const expectedPlanDiscount =
    PLAN_DISCOUNTS[durationMonths];

  if (planDiscount !== expectedPlanDiscount) {
    return false;
  }

  // اگر کد کوپن وجود ندارد، تخفیف کوپن نیز باید صفر باشد.
  if (
    !request.coupon_code &&
    couponDiscount !== 0
  ) {
    return false;
  }

  // اگر کد کوپن وجود دارد، درصد تخفیف آن باید معتبر باشد.
  if (
    request.coupon_code &&
    (
      couponDiscount < 1 ||
      couponDiscount > 90
    )
  ) {
    return false;
  }

  // تخفیف‌ها با هم جمع نمی‌شوند؛ بیشترین مقدار اعمال می‌شود.
  const expectedAppliedDiscount = Math.max(
    planDiscount,
    extraDiscount,
    couponDiscount
  );

  if (appliedDiscount !== expectedAppliedDiscount) {
    return false;
  }

  const expectedPrice = Math.round(
    basePrice * (100 - appliedDiscount) / 100
  );

  return finalPrice === expectedPrice;
}

async function logPurchaseReview({
  request,
  reviewerTelegramUserId,
  decision,
  subscriptionDetails = null,
}) {
  try {
    const admin =
      await adminService.getAdminByTelegramId(
        reviewerTelegramUserId
      );

    if (!admin || !admin.is_active) {
      console.error(
        "Purchase review log skipped: admin not found or inactive."
      );
      return;
    }

    const user =
      await userRepository.findByTelegramId(
        String(request.telegram_user_id)
      );

    if (!user) {
      console.error(
        "Purchase review log skipped: target user not found."
      );
      return;
    }

    const approved = decision === "APPROVED";

    const details = {
      operation: approved
        ? "PURCHASE_APPROVED"
        : "PURCHASE_REJECTED",

      purchaseRequestId: request.id,
      durationMonths: Number(request.duration_months),
      decision,

      reason: approved
        ? "رسید پرداخت خرید Pro توسط مدیر تأیید شد."
        : "رسید پرداخت خرید Pro توسط مدیر رد شد.",
    };

    if (approved && subscriptionDetails) {
      details.subscriptionId =
        subscriptionDetails.subscriptionId;

      details.startsAt =
        subscriptionDetails.startsAt;

      details.expiresAt =
        subscriptionDetails.expiresAt;

      details.priceAmount =
        subscriptionDetails.priceAmount;
    }

    await adminActionLogService.recordAction({
      adminUserId: admin.user_id,
      adminTelegramUserId: reviewerTelegramUserId,
      targetUserId: user.id,
      targetTelegramUserId: request.telegram_user_id,
      action: approved
        ? "PRO_ENABLE"
        : "PRO_PURCHASE_REJECT",
      details,
    });
  } catch (error) {
    console.error(
      "Pro purchase review log failed:",
      error
    );
  }
}

async function reviewPurchaseRequest({
  requestId,
  reviewerTelegramUserId,
  decision,
}) {
  const safeRequestId =
    validatePurchaseRequestId(requestId);

  const normalizedReviewerId =
    validateReviewerId(reviewerTelegramUserId);

  if (!["APPROVED", "REJECTED"].includes(decision)) {
    throw createError("INVALID_PURCHASE_DECISION");
  }

  const db = getClient();
  const client = await db.connect();

  let reviewedRequest = null;
  let subscriptionDetails = null;

  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      `
        SELECT *
        FROM pro_purchase_requests
        WHERE id = $1
        FOR UPDATE
      `,
      [safeRequestId]
    );

    const request = requestResult.rows[0];

    if (!request) {
      await client.query("ROLLBACK");

      return {
        success: false,
        reason: "NOT_FOUND",
      };
    }

    if (request.status !== "RECEIPT_SUBMITTED") {
      await client.query("ROLLBACK");

      return {
        success: false,
        reason: "ALREADY_REVIEWED",
      };
    }

    if (decision === "APPROVED") {
      if (!validatePurchasePriceSnapshot(request)) {
        await client.query("ROLLBACK");

        return {
          success: false,
          reason: "INVALID_PRICE",
        };
      }
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
        throw createError("PRO_PURCHASE_USER_NOT_FOUND");
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

      const priceAmount = Number(
        request.price_amount
      );

      const metadata = {
        purchase_request_id: String(request.id),

        reviewer_telegram_user_id:
          normalizedReviewerId,

        base_price_amount: Number(
          request.base_price_amount
        ),

        plan_discount_percent: Number(
          request.plan_discount_percent
        ),

        extra_discount_percent: Number(
          request.extra_discount_percent
        ),

        coupon_code: request.coupon_code || null,

        coupon_discount_percent: Number(
          request.coupon_discount_percent
        ),

        applied_discount_percent: Number(
          request.applied_discount_percent
        ),

        final_price_amount: priceAmount,
        currency: "IRT",
      };

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
            $5, $6, 'PURCHASE', $7, $8, 'IRT', $9
          )
        `,
        [
          user.id,
          subscriptionId,
          `PURCHASE_${request.duration_months}M`,
          request.duration_months,
          startsAt,
          expiresAt,
          request.id,
          priceAmount,
          JSON.stringify(metadata),
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
        [
          user.id,
          expiresAt,
        ]
      );

      subscriptionDetails = {
        subscriptionId,
        startsAt: startsAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        priceAmount,
      };
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
        safeRequestId,
        decision,
        normalizedReviewerId,
      ]
    );

    if (!updateResult.rows.length) {
      throw createError(
        "PRO_PURCHASE_REVIEW_UPDATE_FAILED"
      );
    }

    reviewedRequest = updateResult.rows[0];

    const notificationMessage =
      decision === "APPROVED"
        ? (
            "🎉 پرداخت زکا پرو تأیید شد!\n\n" +
            "اشتراک پرو با موفقیت فعال شد.\n" +
            `⏳ مدت اشتراک: ${request.duration_months} ماه`
          )
        : (
            "❌ رسید پرداخت زکا پرو تأیید نشد.\n\n" +
            `🆔 شماره درخواست: ${request.id}\n` +
            "لطفاً برای بررسی علت با پشتیبانی تماس بگیر."
          );

    // ثبت اعلان در Outbox داخل همان تراکنش خرید
    await client.query(
      `
        INSERT INTO pro_purchase_notification_outbox (
          purchase_request_id,
          notification_type,
          telegram_user_id,
          message
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (
          purchase_request_id,
          notification_type
        )
        DO NOTHING
      `,
      [
        request.id,
        decision,
        String(request.telegram_user_id),
        notificationMessage,
      ]
    );

    // در صورت رد درخواست، مصرف کوپن آزاد می‌شود.
    // در صورت تأیید، مصرف کوپن باقی می‌ماند.
    if (decision === "REJECTED") {
      await releaseCouponRedemption(
        client,
        request.id
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Pro purchase rollback failed:",
        rollbackError
      );
    }

    throw error;
  } finally {
    client.release();
  }

  await logPurchaseReview({
    request: reviewedRequest,
    reviewerTelegramUserId: normalizedReviewerId,
    decision,
    subscriptionDetails,
  });

  return {
    success: true,
    request: reviewedRequest,
  };
}

module.exports = {
  getPurchaseRequests,
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
