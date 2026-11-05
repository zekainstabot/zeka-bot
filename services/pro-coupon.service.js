const { getPool } = require("../database/pool");

const MIN_DISCOUNT = 1;
const MAX_DISCOUNT = 90;
const MAX_CODE_LENGTH = 50;
const MAX_INTEGER = 2147483647;

// PostgreSQL BIGINT maximum.
const MAX_BIGINT = "9223372036854775807";

function normalizeCode(code) {
  return String(code ?? "")
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

/**
 * Validates a positive PostgreSQL BIGINT identifier.
 * Returns a string to prevent JavaScript precision loss.
 */
function validateBigIntId(value, errorCode) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    throw new Error(errorCode);
  }

  if (
    typeof value === "number" &&
    !Number.isSafeInteger(value)
  ) {
    throw new Error(errorCode);
  }

  let normalized = String(value).trim();

  if (!/^\d+$/.test(normalized)) {
    throw new Error(errorCode);
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
    throw new Error(errorCode);
  }

  return normalized;
}

function validateCouponId(couponId) {
  return validateBigIntId(
    couponId,
    "INVALID_COUPON_ID"
  );
}

function validateTelegramUserId(telegramUserId) {
  return validateBigIntId(
    telegramUserId,
    "INVALID_TELEGRAM_USER_ID"
  );
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

  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_INTEGER
  ) {
    throw new Error("INVALID_COUPON_MAX_USES");
  }

  return value;
}

function validateBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (
    value === 1 ||
    value === "1" ||
    value === "true"
  ) {
    return true;
  }

  if (
    value === 0 ||
    value === "0" ||
    value === "false"
  ) {
    return false;
  }

  throw new Error("INVALID_COUPON_ACTIVE_STATUS");
}

function parseOptionalDate(value, errorCode) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  let date;

  if (value instanceof Date) {
    date = new Date(value.getTime());
  } else if (typeof value === "string") {
    const normalized = value.trim();

    if (!normalized) {
      return null;
    }

    // Validate YYYY-MM-DD strictly to prevent date rollover.
    const dateOnlyMatch = normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]);
      const day = Number(dateOnlyMatch[3]);

      const check = new Date(
        Date.UTC(year, month - 1, day)
      );

      if (
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() !== month - 1 ||
        check.getUTCDate() !== day
      ) {
        throw new Error(errorCode);
      }
    }

    date = new Date(normalized);
  } else {
    throw new Error(errorCode);
  }

  if (Number.isNaN(date.getTime())) {
    throw new Error(errorCode);
  }

  return date;
}

function validatePagination(limit, offset) {
  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);

  let safeLimit = 30;

  if (Number.isFinite(parsedLimit)) {
    safeLimit = Math.floor(parsedLimit);

    safeLimit = Math.max(
      1,
      Math.min(safeLimit, 100)
    );
  }

  let safeOffset = 0;

  if (
    Number.isSafeInteger(parsedOffset) &&
    parsedOffset >= 0
  ) {
    safeOffset = parsedOffset;
  }

  return {
    limit: safeLimit,
    offset: safeOffset,
  };
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

  const startDate = parseOptionalDate(
    startsAt,
    "INVALID_COUPON_START_DATE"
  );

  const expiryDate = parseOptionalDate(
    expiresAt,
    "INVALID_COUPON_EXPIRY_DATE"
  );

  if (
    startDate &&
    expiryDate &&
    expiryDate <= startDate
  ) {
    throw new Error("INVALID_COUPON_DATE_RANGE");
  }

  let creatorId = null;

  if (
    createdBy !== null &&
    createdBy !== undefined &&
    createdBy !== ""
  ) {
    creatorId = validateTelegramUserId(createdBy);
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
        creatorId,
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

  const normalizedTelegramId =
    validateTelegramUserId(telegramUserId);

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
      normalizedTelegramId,
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

  const pagination = validatePagination(
    limit,
    offset
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
      ORDER BY
        coupon.created_at DESC,
        coupon.id DESC
      LIMIT $1 OFFSET $2
    `,
    [
      pagination.limit,
      pagination.offset,
    ]
  );

  return result.rows;
}

async function setCouponActive({
  couponId,
  isActive,
}) {
  const safeCouponId = validateCouponId(couponId);
  const active = validateBoolean(isActive);

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
      safeCouponId,
      active,
    ]
  );

  return result.rows[0] || null;
}

async function deleteCoupon(couponId) {
  const safeCouponId = validateCouponId(couponId);

  const db = getPool();

  const result = await db.query(
    `
      DELETE FROM pro_discount_coupons
      WHERE id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM pro_discount_redemptions redemption
          WHERE redemption.coupon_id =
            pro_discount_coupons.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM pro_purchase_requests request
          WHERE request.coupon_code =
            pro_discount_coupons.code
        )
      RETURNING *
    `,
    [safeCouponId]
  );

  return result.rows[0] || null;
}

module.exports = {
  normalizeCode,
  validateCode,
  validateCouponId,
  validateTelegramUserId,
  validateDiscountPercent,
  validateMaxUses,
  createCoupon,
  getCouponByCode,
  validateCoupon,
  listCoupons,
  setCouponActive,
  deleteCoupon,
};
