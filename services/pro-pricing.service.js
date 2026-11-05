const {
  getSetting,
  setSetting,
} = require("./settings.service");

const { getPool } = require("../database/pool");

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
const DISCOUNT_SETTING_KEY = "pro.extra_discount_percent";

function validateDuration(durationMonths) {
  const duration = Number(durationMonths);

  if (
    !Number.isInteger(duration) ||
    !ALLOWED_DURATIONS.includes(duration)
  ) {
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
  const price = validateBasePrice(basePrice);

  const discount = validateDiscountPercent(
    discountPercent
  );

  const finalPrice = Math.round(
    price * (100 - discount) / 100
  );

  if (
    !Number.isSafeInteger(finalPrice) ||
    finalPrice < 1
  ) {
    throw new Error("INVALID_FINAL_PRO_PRICE");
  }

  return finalPrice;
}

function buildPricing(
  durationMonths,
  basePrice,
  extraDiscountPercent
) {
  const duration = validateDuration(durationMonths);

  const safeBasePrice = validateBasePrice(
    basePrice
  );

  const safeExtraDiscount =
    validateDiscountPercent(extraDiscountPercent);

  const planDiscountPercent =
    PLAN_DISCOUNTS[duration];

  const effectiveDiscountPercent = Math.max(
    planDiscountPercent,
    safeExtraDiscount
  );

  const priceAmount = calculateFinalPrice(
    safeBasePrice,
    effectiveDiscountPercent
  );

  return {
    durationMonths: duration,

    basePriceAmount: safeBasePrice,

    planDiscountPercent,

    extraDiscountPercent: safeExtraDiscount,

    discountPercent: effectiveDiscountPercent,

    priceAmount,
  };
}

function getSettingValue(settings, key, fallback) {
  return settings.has(key)
    ? settings.get(key)
    : fallback;
}

async function readPricingSettings(queryable, durations) {
  const keys = [];

  for (const duration of durations) {
    keys.push(`pro.base_price.${duration}`);
  }

  keys.push(DISCOUNT_SETTING_KEY);

  const result = await queryable.query(
    `
      SELECT
        setting_key,
        setting_value
      FROM system_settings
      WHERE setting_key = ANY($1::text[])
      ORDER BY setting_key
    `,
    [keys]
  );

  return new Map(
    result.rows.map((row) => [
      row.setting_key,
      row.setting_value,
    ])
  );
}

async function getBasePrice(durationMonths) {
  const duration = validateDuration(
    durationMonths
  );

  const value = await getSetting(
    `pro.base_price.${duration}`,
    BASE_PRICES[duration]
  );

  return validateBasePrice(value);
}

async function getAllBasePrices() {
  const db = getPool();

  const settings = await readPricingSettings(
    db,
    ALLOWED_DURATIONS
  );

  const results = {};

  for (const duration of ALLOWED_DURATIONS) {
    const key = `pro.base_price.${duration}`;

    results[duration] = validateBasePrice(
      getSettingValue(
        settings,
        key,
        BASE_PRICES[duration]
      )
    );
  }

  return results;
}

async function setBasePrice(durationMonths, price) {
  const duration = validateDuration(
    durationMonths
  );

  const value = validateBasePrice(price);

  await setSetting(
    `pro.base_price.${duration}`,
    value
  );

  return value;
}

async function getExtraDiscountPercent() {
  const value = await getSetting(
    DISCOUNT_SETTING_KEY,
    0
  );

  return validateDiscountPercent(value);
}

/**
 * خواندن قیمت و تخفیف داخل تراکنش خرید.
 *
 * FOR SHARE مانع تغییر هم‌زمان تنظیمات موجود
 * تا پایان تراکنش خرید می‌شود.
 */
async function getProPricingWithClient(
  client,
  durationMonths
) {
  const duration = validateDuration(
    durationMonths
  );

  const basePriceKey =
    `pro.base_price.${duration}`;

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
    [[basePriceKey, DISCOUNT_SETTING_KEY]]
  );

  const settings = new Map(
    result.rows.map((row) => [
      row.setting_key,
      row.setting_value,
    ])
  );

  const basePrice = validateBasePrice(
    getSettingValue(
      settings,
      basePriceKey,
      BASE_PRICES[duration]
    )
  );

  const extraDiscountPercent =
    validateDiscountPercent(
      getSettingValue(
        settings,
        DISCOUNT_SETTING_KEY,
        0
      )
    );

  return buildPricing(
    duration,
    basePrice,
    extraDiscountPercent
  );
}

/**
 * دریافت قیمت یک پلن با یک کوئری واحد.
 */
async function getProPricing(durationMonths) {
  const duration = validateDuration(
    durationMonths
  );

  const db = getPool();

  const settings = await readPricingSettings(
    db,
    [duration]
  );

  const basePriceKey =
    `pro.base_price.${duration}`;

  const basePrice = validateBasePrice(
    getSettingValue(
      settings,
      basePriceKey,
      BASE_PRICES[duration]
    )
  );

  const extraDiscountPercent =
    validateDiscountPercent(
      getSettingValue(
        settings,
        DISCOUNT_SETTING_KEY,
        0
      )
    );

  return buildPricing(
    duration,
    basePrice,
    extraDiscountPercent
  );
}

/**
 * دریافت تمام پلن‌ها با یک کوئری واحد.
 */
async function getAllProPricing() {
  const db = getPool();

  const settings = await readPricingSettings(
    db,
    ALLOWED_DURATIONS
  );

  const extraDiscountPercent =
    validateDiscountPercent(
      getSettingValue(
        settings,
        DISCOUNT_SETTING_KEY,
        0
      )
    );

  return ALLOWED_DURATIONS.map((duration) => {
    const basePriceKey =
      `pro.base_price.${duration}`;

    const basePrice = validateBasePrice(
      getSettingValue(
        settings,
        basePriceKey,
        BASE_PRICES[duration]
      )
    );

    return buildPricing(
      duration,
      basePrice,
      extraDiscountPercent
    );
  });
}

async function setExtraDiscountPercent(percent) {
  const value = validateDiscountPercent(percent);

  await setSetting(
    DISCOUNT_SETTING_KEY,
    value
  );

  return value;
}

function formatToman(amount) {
  const value = Number(amount);

  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error("INVALID_PRO_PRICE_FORMAT");
  }

  return (
    new Intl.NumberFormat("fa-IR", {
      maximumFractionDigits: 0,
    }).format(value) +
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
