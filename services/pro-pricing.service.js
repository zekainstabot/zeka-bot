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

const ALLOWED_DURATIONS = Object.keys(BASE_PRICES).map(Number);

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

function calculateFinalPrice(basePrice, discountPercent) {
  const price = Number(basePrice);
  const discount = Number(discountPercent);

  return Math.max(
    0,
    Math.round(price * (100 - discount) / 100)
  );
}

async function getExtraDiscountPercent() {
  const value = await getSetting(
    "pro.extra_discount_percent",
    0
  );

  return validateDiscountPercent(value);
}

async function getProPricing(durationMonths) {
  const duration = validateDuration(durationMonths);
  const basePrice = BASE_PRICES[duration];

  const planDiscountPercent = Math.round(
    (1 - basePrice / (BASE_PRICES[1] * duration)) * 100
  );

  const extraDiscountPercent =
    await getExtraDiscountPercent();

  // تخفیف عمومی فقط در صورت بیشتر بودن از تخفیف پلن اعمال می‌شود.
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
    results.push(await getProPricing(duration));
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
  ALLOWED_DURATIONS,
  validateDuration,
  validateDiscountPercent,
  calculateFinalPrice,
  getExtraDiscountPercent,
  getProPricing,
  getAllProPricing,
  setExtraDiscountPercent,
  formatToman,
};
