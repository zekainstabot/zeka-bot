const { Markup } = require("telegraf");

const adminService = require("../services/admin.service");
const pricingService = require("../services/pro-pricing.service");
const adminActionLogService = require("../services/admin-action-log.service");

const flows = new Map();

const PLAN_DURATIONS = [1, 2, 3, 6, 12];
const FLOW_TTL_MS = 10 * 60 * 1000;
const MAX_BASE_PRICE = 1000000000;

function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (digit) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    )
    .replace(/[٠-٩]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    );
}

function formatAmount(value) {
  return (
    new Intl.NumberFormat("fa-IR", {
      maximumFractionDigits: 0,
    }).format(Number(value || 0)) + " تومان"
  );
}

function getFlowKey(ctx) {
  return String(ctx.from.id);
}

function getFlow(ctx) {
  const key = getFlowKey(ctx);
  const state = flows.get(key);

  if (!state) {
    return null;
  }

  if (
    !state.updatedAt ||
    Date.now() - state.updatedAt > FLOW_TTL_MS
  ) {
    flows.delete(key);
    return null;
  }

  return state;
}

function setFlow(ctx, state) {
  flows.set(getFlowKey(ctx), {
    ...state,
    updatedAt: Date.now(),
  });
}

function clearFlow(ctx) {
  flows.delete(getFlowKey(ctx));
}

async function getSuperAdmin(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return null;
  }

  const admin = await adminService.getAdminByTelegramId(
    telegramUserId
  );

  if (
    !admin ||
    !admin.is_active ||
    admin.role_key !== "super_admin"
  ) {
    return null;
  }

  return admin;
}

function pricingMenu() {
  return Markup.keyboard([
    ["📊 مشاهده قیمت پلن‌ها"],
    ["💰 تغییر قیمت پلن‌ها"],
    ["✏️ تغییر تخفیف عمومی"],
    ["🔙 بخش مالی"],
  ])
    .resize()
    .oneTime(false);
}

function cancelMenu() {
  return Markup.keyboard([
    ["❌ لغو عملیات"],
    ["🔙 بخش مالی"],
  ])
    .resize()
    .oneTime(false);
}

function durationMenu() {
  return Markup.keyboard([
    ["۱ ماهه", "۲ ماهه"],
    ["۳ ماهه", "۶ ماهه"],
    ["۱۲ ماهه"],
    ["❌ لغو عملیات"],
    ["🔙 بخش مالی"],
  ])
    .resize()
    .oneTime(false);
}

function parseDuration(value) {
  const normalized = normalizeDigits(value).trim();

  const match = normalized.match(
    /^(\d+)\s*(?:ماهه?)?$/
  );

  if (!match) {
    return null;
  }

  const duration = Number(match[1]);

  if (!PLAN_DURATIONS.includes(duration)) {
    return null;
  }

  return duration;
}

function parseIntegerInput(value, allowSeparators = false) {
  let normalized = normalizeDigits(value).trim();

  if (allowSeparators) {
    normalized = normalized.replace(/[,٬،\s]/g, "");
  }

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const number = Number(normalized);

  if (!Number.isSafeInteger(number)) {
    return null;
  }

  return number;
}

async function showPricing(ctx, includeMenu = true) {
  const plans = await pricingService.getAllProPricing();

  const extraDiscount =
    plans.length > 0
      ? plans[0].extraDiscountPercent
      : await pricingService.getExtraDiscountPercent();

  const lines = plans.map((plan) => {
    return (
      `⭐ پلن ${plan.durationMonths} ماهه\n` +
      `💰 قیمت پایه: ${formatAmount(plan.basePriceAmount)}\n` +
      `🏷️ تخفیف مدت پلن: ${plan.planDiscountPercent}٪\n` +
      `🎁 تخفیف عمومی: ${plan.extraDiscountPercent}٪\n` +
      `📉 تخفیف نهایی اعمال‌شده: ${plan.discountPercent}٪\n` +
      `✅ قیمت نهایی: ${formatAmount(plan.priceAmount)}`
    );
  });

  const message =
    "💎 قیمت‌گذاری اشتراک Pro\n\n" +
    `🎁 تخفیف عمومی فعلی: ${extraDiscount}٪\n\n` +
    "━━━━━━━━━━━━━━\n\n" +
    lines.join("\n\n━━━━━━━━━━━━━━\n\n") +
    "\n\nℹ️ تخفیف عمومی با تخفیف پلن و کد تخفیف جمع نمی‌شود؛ بیشترین درصد تخفیف اعمال خواهد شد.";

  await ctx.reply(
    message,
    includeMenu ? pricingMenu() : undefined
  );
}

async function handlePricingMenu(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    clearFlow(ctx);

    await ctx.reply(
      "⛔ فقط Super Admin به قیمت‌گذاری دسترسی دارد."
    );

    return;
  }

  clearFlow(ctx);

  try {
    await showPricing(ctx);
  } catch (error) {
    console.error("Opening Pro pricing failed:", error);

    await ctx.reply(
      "❌ دریافت اطلاعات قیمت‌گذاری انجام نشد.",
      pricingMenu()
    );
  }
}

async function handlePricingList(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    clearFlow(ctx);

    await ctx.reply("⛔ دسترسی غیرمجاز.");
    return;
  }

  clearFlow(ctx);

  try {
    await showPricing(ctx);
  } catch (error) {
    console.error("Pro pricing list failed:", error);

    await ctx.reply(
      "❌ دریافت قیمت پلن‌ها انجام نشد.",
      pricingMenu()
    );
  }
}

async function handleBasePriceStart(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    clearFlow(ctx);

    await ctx.reply("⛔ دسترسی غیرمجاز.");
    return;
  }

  setFlow(ctx, {
    step: "select_duration",
  });

  await ctx.reply(
    "💰 تغییر قیمت پایه اشتراک Pro\n\n" +
      "پلنی را انتخاب کن که می‌خواهی قیمت آن تغییر کند.\n\n" +
      "توجه: قیمت جدید فقط روی درخواست‌های خرید جدید اعمال می‌شود.",
    durationMenu()
  );
}

async function handleDurationSelection(ctx, text) {
  const duration = parseDuration(text);

  if (!duration) {
    await ctx.reply(
      "❌ پلن انتخاب‌شده معتبر نیست.\n\n" +
        "یکی از گزینه‌های منو را انتخاب کن."
    );

    return;
  }

  try {
    const currentPrice = await pricingService.getBasePrice(
      duration
    );

    setFlow(ctx, {
      step: "base_price",
      durationMonths: duration,
      currentPrice,
    });

    await ctx.reply(
      `⭐ پلن انتخاب‌شده: ${duration} ماهه\n\n` +
        `💰 قیمت پایه فعلی: ${formatAmount(currentPrice)}\n\n` +
        "قیمت پایه جدید را به تومان وارد کن.\n\n" +
        "مثال: 25000\n\n" +
        "حداقل مبلغ: ۱ تومان\n" +
        "حداکثر مبلغ: ۱ میلیارد تومان",
      cancelMenu()
    );
  } catch (error) {
    console.error("Reading Pro base price failed:", error);

    clearFlow(ctx);

    await ctx.reply(
      "❌ دریافت قیمت فعلی پلن انجام نشد.",
      pricingMenu()
    );
  }
}

async function handleBasePriceInput(ctx, text, state, admin) {
  const price = parseIntegerInput(text, true);

  if (
    price === null ||
    price < 1 ||
    price > MAX_BASE_PRICE
  ) {
    await ctx.reply(
      "❌ مبلغ واردشده معتبر نیست.\n\n" +
        "فقط عدد صحیح بین ۱ تا ۱٬۰۰۰٬۰۰۰٬۰۰۰ تومان مجاز است."
    );

    return;
  }

  const duration = state.durationMonths;

  if (!PLAN_DURATIONS.includes(duration)) {
    clearFlow(ctx);

    await ctx.reply(
      "❌ وضعیت عملیات نامعتبر است. دوباره شروع کن.",
      pricingMenu()
    );

    return;
  }

  try {
    const previousPrice = state.currentPrice;

    const savedPrice = await pricingService.setBasePrice(
      duration,
      price
    );

    try {
      await adminActionLogService.recordAction({
        adminUserId: admin.user_id,
        adminTelegramUserId: ctx.from.id,
        action: "PRO_BASE_PRICE_UPDATE",
        details: {
          duration_months: duration,
          previous_price_amount: previousPrice,
          new_price_amount: savedPrice,
          currency: "IRT",
          source: "SUPER_ADMIN_FINANCE",
        },
      });
    } catch (logError) {
      console.error(
        "Pro base price action log failed:",
        logError
      );
    }

    clearFlow(ctx);

    await ctx.reply(
      "✅ قیمت پایه پلن با موفقیت تغییر کرد.\n\n" +
        `⭐ پلن: ${duration} ماهه\n` +
        `💰 قیمت قبلی: ${formatAmount(previousPrice)}\n` +
        `💰 قیمت جدید: ${formatAmount(savedPrice)}\n\n` +
        "درخواست‌های خرید جدید با قیمت جدید محاسبه می‌شوند.\n" +
        "قیمت درخواست‌های قبلی تغییر نمی‌کند.",
      pricingMenu()
    );

    await showPricing(ctx, false);
  } catch (error) {
    console.error("Saving Pro base price failed:", error);

    clearFlow(ctx);

    await ctx.reply(
      "❌ ذخیره قیمت جدید انجام نشد.",
      pricingMenu()
    );
  }
}

async function handleDiscountStart(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    clearFlow(ctx);

    await ctx.reply("⛔ دسترسی غیرمجاز.");
    return;
  }

  try {
    const currentDiscount =
      await pricingService.getExtraDiscountPercent();

    setFlow(ctx, {
      step: "discount",
      currentDiscount,
    });

    await ctx.reply(
      "✏️ تغییر تخفیف عمومی Pro\n\n" +
        `🎁 تخفیف فعلی: ${currentDiscount}٪\n\n` +
        "درصد جدید را وارد کن.\n\n" +
        "محدوده مجاز: صفر تا ۹۰\n\n" +
        "برای غیرفعال‌کردن تخفیف عمومی، عدد ۰ را وارد کن.",
      cancelMenu()
    );
  } catch (error) {
    console.error(
      "Starting Pro discount update failed:",
      error
    );

    clearFlow(ctx);

    await ctx.reply(
      "❌ دریافت تخفیف فعلی انجام نشد.",
      pricingMenu()
    );
  }
}

async function handleDiscountInput(ctx, text, state, admin) {
  const discount = parseIntegerInput(text);

  if (
    discount === null ||
    discount < 0 ||
    discount > 90
  ) {
    await ctx.reply(
      "❌ درصد تخفیف نامعتبر است.\n\n" +
        "فقط عدد صحیح بین صفر تا ۹۰ مجاز است."
    );

    return;
  }

  try {
    const previousDiscount = state.currentDiscount;

    const savedDiscount =
      await pricingService.setExtraDiscountPercent(
        discount
      );

    try {
      await adminActionLogService.recordAction({
        adminUserId: admin.user_id,
        adminTelegramUserId: ctx.from.id,
        action: "PRO_EXTRA_DISCOUNT_UPDATE",
        details: {
          previous_discount_percent: previousDiscount,
          new_discount_percent: savedDiscount,
          source: "SUPER_ADMIN_FINANCE",
        },
      });
    } catch (logError) {
      console.error(
        "Pro discount action log failed:",
        logError
      );
    }

    clearFlow(ctx);

    await ctx.reply(
      "✅ تخفیف عمومی Pro با موفقیت تغییر کرد.\n\n" +
        `📉 تخفیف قبلی: ${previousDiscount}٪\n` +
        `🎁 تخفیف جدید: ${savedDiscount}٪\n\n` +
        "قیمت درخواست‌های خرید جدید با تنظیم جدید محاسبه می‌شود.\n" +
        "درخواست‌های قبلی تغییر نمی‌کنند.",
      pricingMenu()
    );

    await showPricing(ctx, false);
  } catch (error) {
    console.error("Saving Pro discount failed:", error);

    clearFlow(ctx);

    await ctx.reply(
      "❌ ذخیره تخفیف عمومی انجام نشد.",
      pricingMenu()
    );
  }
}

async function handlePricingText(ctx, next) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return next();
  }

  const state = getFlow(ctx);

  if (!state) {
    return next();
  }

  const text = String(
    ctx.message?.text || ""
  ).trim();

  // خروج از جریان قیمت‌گذاری
  if (
    text === "🔙 بخش مالی" ||
    text === "🔙 پنل Super Admin"
  ) {
    clearFlow(ctx);
    return next();
  }

  // لغو عملیات
  if (text === "❌ لغو عملیات") {
    clearFlow(ctx);

    await ctx.reply(
      "عملیات لغو شد.",
      pricingMenu()
    );

    return;
  }

  // تغییر منو باید جریان قبلی را متوقف کند.
  const navigationButtons = [
    "🏷️ تخفیف عمومی Pro",
    "📊 مشاهده قیمت پلن‌ها",
    "💰 تغییر قیمت پلن‌ها",
    "✏️ تغییر تخفیف عمومی",
  ];

  if (navigationButtons.includes(text)) {
    clearFlow(ctx);
    return next();
  }

  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    clearFlow(ctx);

    await ctx.reply(
      "⛔ دسترسی غیرمجاز."
    );

    return;
  }

  if (state.step === "select_duration") {
    await handleDurationSelection(ctx, text);
    return;
  }

  if (state.step === "base_price") {
    await handleBasePriceInput(
      ctx,
      text,
      state,
      admin
    );

    return;
  }

  if (state.step === "discount") {
    await handleDiscountInput(
      ctx,
      text,
      state,
      admin
    );

    return;
  }

  clearFlow(ctx);
  return next();
}

function createSuperAdminFinancePricingHandler(bot) {
  bot.on("text", handlePricingText);

  bot.hears(
    "🏷️ تخفیف عمومی Pro",
    handlePricingMenu
  );

  bot.hears(
    "📊 مشاهده قیمت پلن‌ها",
    handlePricingList
  );

  bot.hears(
    "💰 تغییر قیمت پلن‌ها",
    handleBasePriceStart
  );

  bot.hears(
    "✏️ تغییر تخفیف عمومی",
    handleDiscountStart
  );
}

module.exports = {
  createSuperAdminFinancePricingHandler,
};
