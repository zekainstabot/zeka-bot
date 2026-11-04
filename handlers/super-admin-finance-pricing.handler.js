
const { Markup } = require("telegraf");

const adminService = require("../services/admin.service");
const pricingService = require("../services/pro-pricing.service");
const adminActionLogService = require("../services/admin-action-log.service");

const flows = new Map();

function normalizeDigits(value) {
  return String(value || "")
    .replace(/[۰-۹]/g, (digit) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    )
    .replace(/[٠-٩]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    );
}

function formatAmount(value) {
  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0)) + " تومان";
}

async function getSuperAdmin(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) return null;

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

async function showPricing(ctx, includeMenu = true) {
  const [plans, extraDiscount] = await Promise.all([
    pricingService.getAllProPricing(),
    pricingService.getExtraDiscountPercent(),
  ]);

  const lines = plans.map((plan) => {
    return (
      `⭐ پلن ${plan.durationMonths} ماهه\n` +
      `💰 قیمت پایه: ${formatAmount(plan.basePriceAmount)}\n` +
      `🏷️ تخفیف مدت پلن: ${plan.planDiscountPercent}٪\n` +
      `🎁 تخفیف عمومی: ${extraDiscount}٪\n` +
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
    await ctx.reply("⛔ فقط Super Admin به قیمت‌گذاری دسترسی دارد.");
    return;
  }

  await showPricing(ctx);
}

async function handlePricingList(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply("⛔ دسترسی غیرمجاز.");
    return;
  }

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

async function handleDiscountStart(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply("⛔ دسترسی غیرمجاز.");
    return;
  }

  try {
    const currentDiscount =
      await pricingService.getExtraDiscountPercent();

    flows.set(String(ctx.from.id), {
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
    console.error("Starting Pro discount update failed:", error);

    await ctx.reply(
      "❌ دریافت تخفیف فعلی انجام نشد.",
      pricingMenu()
    );
  }
}

async function handleDiscountInput(ctx, text, state, admin) {
  const normalized = normalizeDigits(text);
  const discount = Number(normalized);

  if (
    !Number.isInteger(discount) ||
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

    flows.delete(String(ctx.from.id));

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

    await ctx.reply(
      "❌ ذخیره تخفیف عمومی انجام نشد.",
      pricingMenu()
    );

    flows.delete(String(ctx.from.id));
  }
}

async function handlePricingText(ctx, next) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return next();
  }

  const key = String(telegramUserId);
  const state = flows.get(key);

  if (!state) {
    return next();
  }

  const text = String(
    ctx.message?.text || ""
  ).trim();

  if (
    text === "🔙 بخش مالی" ||
    text === "🔙 پنل Super Admin"
  ) {
    flows.delete(key);
    return next();
  }

  if (text === "❌ لغو عملیات") {
    flows.delete(key);

    await ctx.reply(
      "عملیات تغییر تخفیف لغو شد.",
      pricingMenu()
    );

    return;
  }

  if (
    text === "🏷️ تخفیف عمومی Pro" ||
    text === "📊 مشاهده قیمت پلن‌ها" ||
    text === "✏️ تغییر تخفیف عمومی"
  ) {
    return next();
  }

  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    flows.delete(key);
    await ctx.reply("⛔ دسترسی غیرمجاز.");
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

  flows.delete(key);
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
    "✏️ تغییر تخفیف عمومی",
    handleDiscountStart
  );
}

module.exports = {
  createSuperAdminFinancePricingHandler,
};
