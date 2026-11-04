
const {
  getSetting,
  setSetting,
} = require("./settings.service");

const BASE_PRICES = Object.freeze({
  1: 20000,
  2: 38000,
  3: 54000,
  6: 102000,
  12: 192000,
});

const PLAN_DISCOUNTS = Object.freeze({
  1: 0,
  2: 5,
  3: 10,
  6: 15,
  12: 20,
});

const ALLOWED_DURATIONS = Object.keys(BASE_PRICES).map(Number);
const MAX_BASE_PRICE = 1000000000;

function validateDuration(durationMonths) {
  const duration = Number(durationMonths);

  if (!ALLOWED_DURATIONS.includes(duration)) {
    throw new Error("INVALID_PRO_DURATION");
  }

  return duration;
}

function validateDiscountPercent(percent) {
  const value = Number(percent);

  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 90
  ) {
    throw new Error("INVALID_PRO_DISCOUNT_PERCENT");
  }

  return value;
}

function validateBasePrice(price) {
  const value = Number(price);

  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_BASE_PRICE
  ) {
    throw new Error("INVALID_PRO_BASE_PRICE");
  }

  return value;
}

function calculateFinalPrice(basePrice, discountPercent) {
  const price = Number(basePrice);
  const discount = Number(discountPercent);

  return Math.max(
    0,
    Math.round(price * (100 - discount) / 100)
  );
}

async function getBasePrice(durationMonths) {
  const duration = validateDuration(durationMonths);

  const value = await getSetting(
    `pro.base_price.${duration}`,
    BASE_PRICES[duration]
  );

  return validateBasePrice(value);
}

async function getAllBasePrices() {
  const results = {};

  for (const duration of ALLOWED_DURATIONS) {
    results[duration] = await getBasePrice(duration);
  }

  return results;
}

async function setBasePrice(durationMonths, price) {
  const duration = validateDuration(durationMonths);
  const value = validateBasePrice(price);

  await setSetting(
    `pro.base_price.${duration}`,
    value
  );

  return value;
}

async function getExtraDiscountPercent() {
  const value = await getSetting(
    "pro.extra_discount_percent",
    0
  );

  return validateDiscountPercent(value);
}

/**
 * خواندن قیمت و تخفیف عمومی داخل تراکنش خرید.
 *
 * FOR SHARE باعث می‌شود تغییر تنظیمات توسط ادمین
 * تا پایان تراکنش خرید منتظر بماند.
 */
async function getProPricingWithClient(
  client,
  durationMonths
) {
  const duration = validateDuration(durationMonths);

  const basePriceKey = `pro.base_price.${duration}`;
  const discountKey = "pro.extra_discount_percent";

  const result = await client.query(
    `
      SELECT
        setting_key,
        setting_value
      FROM system_settings
      WHERE setting_key = ANY($1::text[])
      ORDER BY setting_key
      FOR SHARE
    `,
    [[basePriceKey, discountKey]]
  );

  const settings = new Map(
    result.rows.map((row) => [
      row.setting_key,
      row.setting_value,
    ])
  );

  const basePrice = validateBasePrice(
    settings.has(basePriceKey)
      ? settings.get(basePriceKey)
      : BASE_PRICES[duration]
  );

  const extraDiscountPercent =
    validateDiscountPercent(
      settings.has(discountKey)
        ? settings.get(discountKey)
        : 0
    );

  const planDiscountPercent =
    PLAN_DISCOUNTS[duration];

  const effectiveDiscountPercent = Math.max(
    planDiscountPercent,
    extraDiscountPercent
  );

  return {
    durationMonths: duration,
    basePriceAmount: basePrice,
    planDiscountPercent,
    extraDiscountPercent,
    discountPercent: effectiveDiscountPercent,
    priceAmount: calculateFinalPrice(
      basePrice,
      effectiveDiscountPercent
    ),
  };
}

async function getProPricing(durationMonths) {
  const duration = validateDuration(durationMonths);

  const [basePrice, extraDiscountPercent] =
    await Promise.all([
      getBasePrice(duration),
      getExtraDiscountPercent(),
    ]);

  const planDiscountPercent =
    PLAN_DISCOUNTS[duration];

  const effectiveDiscountPercent = Math.max(
    planDiscountPercent,
    extraDiscountPercent
  );

  return {
    durationMonths: duration,
    basePriceAmount: basePrice,
    planDiscountPercent,
    extraDiscountPercent,
    discountPercent: effectiveDiscountPercent,
    priceAmount: calculateFinalPrice(
      basePrice,
      effectiveDiscountPercent
    ),
  };
}

async function getAllProPricing() {
  const results = [];

  for (const duration of ALLOWED_DURATIONS) {
    results.push(
      await getProPricing(duration)
    );
  }

  return results;
}

async function setExtraDiscountPercent(percent) {
  const value = validateDiscountPercent(percent);

  await setSetting(
    "pro.extra_discount_percent",
    value
  );

  return value;
}

function formatToman(amount) {
  return (
    new Intl.NumberFormat("fa-IR", {
      maximumFractionDigits: 0,
    }).format(Number(amount || 0)) +
    " تومان"
  );
}

module.exports = {
  BASE_PRICES,
  PLAN_DISCOUNTS,
  ALLOWED_DURATIONS,

  validateDuration,
  validateDiscountPercent,
  validateBasePrice,

  calculateFinalPrice,

  getBasePrice,
  getAllBasePrices,
  setBasePrice,

  getExtraDiscountPercent,

  getProPricing,
  getProPricingWithClient,
  getAllProPricing,

  setExtraDiscountPercent,

  formatToman,
};
