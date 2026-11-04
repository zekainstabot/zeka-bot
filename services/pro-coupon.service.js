const { getPool } = require("../database/pool");

const MIN_DISCOUNT = 1;
const MAX_DISCOUNT = 90;
const MAX_CODE_LENGTH = 50;

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function validateCode(code) {
  const normalized = normalizeCode(code);

  if (
    !normalized ||
    normalized.length > MAX_CODE_LENGTH ||
    !/^[A-Z0-9_-]+$/.test(normalized)
  ) {
    throw new Error("INVALID_COUPON_CODE");
  }

  return normalized;
}

function validateDiscountPercent(percent) {
  const value = Number(percent);

  if (
    !Number.isInteger(value) ||
    value < MIN_DISCOUNT ||
    value > MAX_DISCOUNT
  ) {
    throw new Error("INVALID_COUPON_DISCOUNT");
  }

  return value;
}

function validateMaxUses(maxUses) {
  if (
    maxUses === null ||
    maxUses === undefined ||
    maxUses === ""
  ) {
    return null;
  }

  const value = Number(maxUses);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error("INVALID_COUPON_MAX_USES");
  }

  return value;
}

async function createCoupon({
  code,
  discountPercent,
  maxUses = null,
  startsAt = null,
  expiresAt = null,
  createdBy = null,
}) {
  const normalizedCode = validateCode(code);
  const discount = validateDiscountPercent(
    discountPercent
  );
  const usageLimit = validateMaxUses(maxUses);

  const startDate = startsAt
    ? new Date(startsAt)
    : null;

  const expiryDate = expiresAt
    ? new Date(expiresAt)
    : null;

  if (
    startDate &&
    Number.isNaN(startDate.getTime())
  ) {
    throw new Error("INVALID_COUPON_START_DATE");
  }

  if (
    expiryDate &&
    Number.isNaN(expiryDate.getTime())
  ) {
    throw new Error("INVALID_COUPON_EXPIRY_DATE");
  }

  if (
    startDate &&
    expiryDate &&
    expiryDate <= startDate
  ) {
    throw new Error("INVALID_COUPON_DATE_RANGE");
  }

  const db = getPool();

  try {
    const result = await db.query(
      `
        INSERT INTO pro_discount_coupons (
          code,
          discount_percent,
          max_uses,
          starts_at,
          expires_at,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        normalizedCode,
        discount,
        usageLimit,
        startDate,
        expiryDate,
        createdBy ? String(createdBy) : null,
      ]
    );

    return result.rows[0];
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(
        "COUPON_CODE_ALREADY_EXISTS"
      );

      duplicateError.code =
        "COUPON_CODE_ALREADY_EXISTS";

      throw duplicateError;
    }

    throw error;
  }
}

async function getCouponByCode(code) {
  const normalizedCode = validateCode(code);
  const db = getPool();

  const result = await db.query(
    `
      SELECT *
      FROM pro_discount_coupons
      WHERE code = $1
      LIMIT 1
    `,
    [normalizedCode]
  );

  return result.rows[0] || null;
}

async function validateCoupon({
  code,
  telegramUserId,
}) {
  const normalizedCode = validateCode(code);
  const db = getPool();

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

  const coupon = result.rows[0];

  if (!coupon) {
    return {
      valid: false,
      reason: "NOT_FOUND",
    };
  }

  if (!coupon.is_active) {
    return {
      valid: false,
      reason: "INACTIVE",
    };
  }

  const now = new Date();

  if (
    coupon.starts_at &&
    new Date(coupon.starts_at) > now
  ) {
    return {
      valid: false,
      reason: "NOT_STARTED",
    };
  }

  if (
    coupon.expires_at &&
    new Date(coupon.expires_at) <= now
  ) {
    return {
      valid: false,
      reason: "EXPIRED",
    };
  }

  if (
    coupon.max_uses !== null &&
    Number(coupon.usage_count) >=
      Number(coupon.max_uses)
  ) {
    return {
      valid: false,
      reason: "LIMIT_REACHED",
    };
  }

  if (coupon.already_used) {
    return {
      valid: false,
      reason: "ALREADY_USED",
    };
  }

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discountPercent: Number(
        coupon.discount_percent
      ),
    },
  };
}

async function listCoupons({
  limit = 30,
  offset = 0,
} = {}) {
  const db = getPool();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 30, 100)
  );

  const safeOffset = Math.max(
    0,
    Math.floor(Number(offset) || 0)
  );

  const result = await db.query(
    `
      SELECT
        coupon.*,
        (
          SELECT COUNT(*)
          FROM pro_discount_redemptions redemption
          WHERE redemption.coupon_id = coupon.id
        ) AS actual_usage_count
      FROM pro_discount_coupons coupon
      ORDER BY coupon.created_at DESC, coupon.id DESC
      LIMIT $1 OFFSET $2
    `,
    [safeLimit, safeOffset]
  );

  return result.rows;
}

async function setCouponActive({
  couponId,
  isActive,
}) {
  const db = getPool();

  const result = await db.query(
    `
      UPDATE pro_discount_coupons
      SET
        is_active = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      couponId,
      Boolean(isActive),
    ]
  );

  return result.rows[0] || null;
}

async function deleteCoupon(couponId) {
  const db = getPool();

  const result = await db.query(
    `
      DELETE FROM pro_discount_coupons
      WHERE id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM pro_discount_redemptions redemption
          WHERE redemption.coupon_id = pro_discount_coupons.id
        )
      RETURNING *
    `,
    [couponId]
  );

  return result.rows[0] || null;
}

module.exports = {
  normalizeCode,
  validateCode,
  createCoupon,
  getCouponByCode,
  validateCoupon,
  listCoupons,
  setCouponActive,
  deleteCoupon,
};
