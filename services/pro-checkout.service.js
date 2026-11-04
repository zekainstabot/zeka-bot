
const { getClient } = require("../database/client");

const {
  getProPricing,
  getProPricingWithClient,
  calculateFinalPrice,
} = require("./pro-pricing.service");

const OPEN_STATUSES = [
  "PENDING",
  "WAITING_RECEIPT",
  "RECEIPT_SUBMITTED",
];

function normalizeCouponCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function getCouponError(reason) {
  const error = new Error(reason);
  error.code = reason;
  return error;
}

function validateCouponRow(row, telegramUserId) {
  if (!row) {
    return "NOT_FOUND";
  }

  if (!row.is_active) {
    return "INACTIVE";
  }

  const now = new Date();

  if (
    row.starts_at &&
    new Date(row.starts_at) > now
  ) {
    return "NOT_STARTED";
  }

  if (
    row.expires_at &&
    new Date(row.expires_at) <= now
  ) {
    return "EXPIRED";
  }

  if (
    row.max_uses !== null &&
    Number(row.usage_count) >= Number(row.max_uses)
  ) {
    return "LIMIT_REACHED";
  }

  if (row.already_used) {
    return "ALREADY_USED";
  }

  return null;
}

async function getCouponForQuote(
  db,
  code,
  telegramUserId
) {
  const normalizedCode = normalizeCouponCode(code);

  if (
    !normalizedCode ||
    !/^[A-Z0-9_-]{1,50}$/.test(normalizedCode)
  ) {
    return {
      valid: false,
      reason: "INVALID_FORMAT",
    };
  }

  const result = await db.query(
    `
      SELECT
        coupon.*,
        EXISTS (
          SELECT 1
          FROM pro_discount_redemptions redemption
          WHERE redemption.coupon_id = coupon.id
            AND redemption.telegram_user_id = $2
        ) AS already_used
      FROM pro_discount_coupons coupon
      WHERE coupon.code = $1
      LIMIT 1
    `,
    [
      normalizedCode,
      String(telegramUserId),
    ]
  );

  const row = result.rows[0];

  const reason = validateCouponRow(
    row,
    telegramUserId
  );

  if (reason) {
    return {
      valid: false,
      reason,
    };
  }

  return {
    valid: true,
    coupon: {
      id: row.id,
      code: row.code,
      discountPercent: Number(
        row.discount_percent
      ),
    },
  };
}

function buildQuote(pricing, coupon = null) {
  const couponDiscountPercent =
    coupon?.discountPercent || 0;

  const appliedDiscountPercent = Math.max(
    pricing.planDiscountPercent,
    pricing.extraDiscountPercent,
    couponDiscountPercent
  );

  return {
    valid: true,

    durationMonths: pricing.durationMonths,

    basePriceAmount: pricing.basePriceAmount,

    planDiscountPercent:
      pricing.planDiscountPercent,

    extraDiscountPercent:
      pricing.extraDiscountPercent,

    couponCode: coupon?.code || null,

    couponDiscountPercent,

    appliedDiscountPercent,

    priceAmount: calculateFinalPrice(
      pricing.basePriceAmount,
      appliedDiscountPercent
    ),
  };
}

async function getCheckoutQuote({
  durationMonths,
  telegramUserId,
  couponCode = null,
}) {
  const pricing = await getProPricing(durationMonths);

  let coupon = null;

  if (couponCode) {
    const db = getClient();

    const result = await getCouponForQuote(
      db,
      couponCode,
      telegramUserId
    );

    if (!result.valid) {
      return result;
    }

    coupon = result.coupon;
  }

  return buildQuote(pricing, coupon);
}

async function createPricedPurchaseRequest({
  telegramUserId,
  username,
  displayName,
  durationMonths,
  couponCode = null,
}) {
  const normalizedTelegramId = String(
    telegramUserId
  );

  const normalizedCouponCode = couponCode
    ? normalizeCouponCode(couponCode)
    : null;

  if (
    normalizedCouponCode &&
    !/^[A-Z0-9_-]{1,50}$/.test(normalizedCouponCode)
  ) {
    throw getCouponError("INVALID_FORMAT");
  }

  const db = getClient();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // جلوگیری از ثبت هم‌زمان چند درخواست برای یک کاربر
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`pro-purchase-user:${normalizedTelegramId}`]
    );

    const existing = await client.query(
      `
        SELECT *
        FROM pro_purchase_requests
        WHERE telegram_user_id = $1
          AND status = ANY($2::varchar[])
        ORDER BY
          CASE
            WHEN status = 'RECEIPT_SUBMITTED' THEN 0
            WHEN status = 'WAITING_RECEIPT' THEN 1
            ELSE 2
          END,
          created_at DESC
        LIMIT 1
      `,
      [
        normalizedTelegramId,
        OPEN_STATUSES,
      ]
    );

    if (existing.rows.length) {
      await client.query("COMMIT");

      return {
        request: existing.rows[0],
        alreadyPending: true,
      };
    }

    // قیمت و تخفیف از تنظیمات لحظه ثبت درخواست خوانده می‌شوند.
    // قفل تنظیمات تا پایان تراکنش نگه داشته می‌شود.
    const pricing = await getProPricingWithClient(
      client,
      durationMonths
    );

    let couponRow = null;

    if (normalizedCouponCode) {
      const couponResult = await client.query(
        `
          SELECT
            coupon.*,
            EXISTS (
              SELECT 1
              FROM pro_discount_redemptions redemption
              WHERE redemption.coupon_id = coupon.id
                AND redemption.telegram_user_id = $2
            ) AS already_used
          FROM pro_discount_coupons coupon
          WHERE coupon.code = $1
          FOR UPDATE OF coupon
        `,
        [
          normalizedCouponCode,
          normalizedTelegramId,
        ]
      );

      couponRow = couponResult.rows[0];

      const couponError = validateCouponRow(
        couponRow,
        normalizedTelegramId
      );

      if (couponError) {
        throw getCouponError(
          couponError === "ALREADY_USED"
            ? "COUPON_ALREADY_USED"
            : "COUPON_UNAVAILABLE"
        );
      }
    }

    const coupon = couponRow
      ? {
          id: couponRow.id,
          code: couponRow.code,
          discountPercent: Number(
            couponRow.discount_percent
          ),
        }
      : null;

    const quote = buildQuote(pricing, coupon);

    const requestResult = await client.query(
      `
        INSERT INTO pro_purchase_requests (
          telegram_user_id,
          username,
          display_name,
          duration_months,

          base_price_amount,

          plan_discount_percent,
          extra_discount_percent,
          coupon_code,
          coupon_discount_percent,

          applied_discount_percent,
          price_amount
        )
        VALUES (
          $1, $2, $3, $4,
          $5,
          $6, $7, $8, $9,
          $10, $11
        )
        RETURNING *
      `,
      [
        normalizedTelegramId,
        username || null,
        displayName || null,
        quote.durationMonths,

        quote.basePriceAmount,

        quote.planDiscountPercent,
        quote.extraDiscountPercent,
        quote.couponCode,
        quote.couponDiscountPercent,

        quote.appliedDiscountPercent,
        quote.priceAmount,
      ]
    );

    const request = requestResult.rows[0];

    if (couponRow) {
      await client.query(
        `
          INSERT INTO pro_discount_redemptions (
            coupon_id,
            purchase_request_id,
            telegram_user_id,
            discount_percent
          )
          VALUES ($1, $2, $3, $4)
        `,
        [
          couponRow.id,
          request.id,
          normalizedTelegramId,
          quote.couponDiscountPercent,
        ]
      );

      await client.query(
        `
          UPDATE pro_discount_coupons
          SET
            usage_count = usage_count + 1,
            updated_at = NOW()
          WHERE id = $1
        `,
        [couponRow.id]
      );
    }

    await client.query("COMMIT");

    return {
      request,
      alreadyPending: false,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Pro checkout rollback failed:",
        rollbackError
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getCheckoutQuote,
  createPricedPurchaseRequest,
};
