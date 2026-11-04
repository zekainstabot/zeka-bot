const { getClient } = require("../database/client");
const { getProPricing } = require("./pro-pricing.service");

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

function calculatePrice(basePrice, discountPercent) {
  return Math.max(
    0,
    Math.round(
      Number(basePrice) *
        (100 - Number(discountPercent)) /
        100
    )
  );
}

async function getCheckoutQuote({
  durationMonths,
  telegramUserId,
  couponCode = null,
}) {
  const pricing = await getProPricing(durationMonths);

  let coupon = null;

  if (couponCode) {
    const normalizedCode = normalizeCouponCode(couponCode);

    if (
      !normalizedCode ||
      !/^[A-Z0-9_-]{1,50}$/.test(normalizedCode)
    ) {
      return {
        valid: false,
        reason: "INVALID_FORMAT",
      };
    }

    const db = getClient();

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

    if (!row) {
      return { valid: false, reason: "NOT_FOUND" };
    }

    if (!row.is_active) {
      return { valid: false, reason: "INACTIVE" };
    }

    const now = new Date();

    if (
      row.starts_at &&
      new Date(row.starts_at) > now
    ) {
      return { valid: false, reason: "NOT_STARTED" };
    }

    if (
      row.expires_at &&
      new Date(row.expires_at) <= now
    ) {
      return { valid: false, reason: "EXPIRED" };
    }

    if (
      row.max_uses !== null &&
      Number(row.usage_count) >= Number(row.max_uses)
    ) {
      return { valid: false, reason: "LIMIT_REACHED" };
    }

    if (row.already_used) {
      return { valid: false, reason: "ALREADY_USED" };
    }

    coupon = {
      id: row.id,
      code: row.code,
      discountPercent: Number(row.discount_percent),
    };
  }

  const couponDiscountPercent =
    coupon?.discountPercent || 0;

  const appliedDiscountPercent = Math.max(
    Number(pricing.planDiscountPercent || 0),
    Number(pricing.extraDiscountPercent || 0),
    couponDiscountPercent
  );

  return {
    valid: true,
    durationMonths: pricing.durationMonths,
    basePriceAmount: pricing.basePriceAmount,
    planDiscountPercent: pricing.planDiscountPercent,
    extraDiscountPercent: pricing.extraDiscountPercent,
    couponCode: coupon?.code || null,
    couponDiscountPercent,
    appliedDiscountPercent,
    priceAmount: calculatePrice(
      pricing.basePriceAmount,
      appliedDiscountPercent
    ),
  };
}

async function createPricedPurchaseRequest({
  telegramUserId,
  username,
  displayName,
  durationMonths,
  couponCode = null,
}) {
  const quote = await getCheckoutQuote({
    durationMonths,
    telegramUserId,
    couponCode,
  });

  if (!quote.valid) {
    const error = new Error("INVALID_OR_UNAVAILABLE_COUPON");
    error.code = quote.reason;
    throw error;
  }

  const normalizedTelegramId = String(telegramUserId);
  const db = getClient();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

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
      [normalizedTelegramId, OPEN_STATUSES]
    );

    if (existing.rows.length) {
      await client.query("COMMIT");

      return {
        request: existing.rows[0],
        alreadyPending: true,
      };
    }

    let couponRow = null;

    if (quote.couponCode) {
      const couponResult = await client.query(
        `
          SELECT *
          FROM pro_discount_coupons
          WHERE code = $1
          FOR UPDATE
        `,
        [quote.couponCode]
      );

      couponRow = couponResult.rows[0];

      const now = new Date();

      if (
        !couponRow ||
        !couponRow.is_active ||
        (couponRow.starts_at &&
          new Date(couponRow.starts_at) > now) ||
        (couponRow.expires_at &&
          new Date(couponRow.expires_at) <= now) ||
        (couponRow.max_uses !== null &&
          Number(couponRow.usage_count) >=
            Number(couponRow.max_uses))
      ) {
        const error = new Error("COUPON_UNAVAILABLE");
        error.code = "COUPON_UNAVAILABLE";
        throw error;
      }

      const alreadyUsed = await client.query(
        `
          SELECT id
          FROM pro_discount_redemptions
          WHERE coupon_id = $1
            AND telegram_user_id = $2
          LIMIT 1
        `,
        [couponRow.id, normalizedTelegramId]
      );

      if (alreadyUsed.rows.length) {
        const error = new Error("COUPON_ALREADY_USED");
        error.code = "COUPON_ALREADY_USED";
        throw error;
      }
    }

    const appliedDiscountPercent = Math.max(
      Number(quote.planDiscountPercent || 0),
      Number(quote.extraDiscountPercent || 0),
      couponRow
        ? Number(couponRow.discount_percent)
        : 0
    );

    const finalPrice = calculatePrice(
      quote.basePriceAmount,
      appliedDiscountPercent
    );

    const requestResult = await client.query(
      `
        INSERT INTO pro_purchase_requests (
          telegram_user_id,
          username,
          display_name,
          duration_months,
          base_price_amount,
          plan_discount_percent,
          coupon_code,
          coupon_discount_percent,
          price_amount
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [
        normalizedTelegramId,
        username || null,
        displayName || null,
        Number(durationMonths),
        quote.basePriceAmount,
        quote.planDiscountPercent,
        couponRow?.code || null,
        couponRow
          ? Number(couponRow.discount_percent)
          : 0,
        finalPrice,
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
          Number(couponRow.discount_percent),
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
