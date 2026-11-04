const { Markup } = require("telegraf");

const adminService = require("../services/admin.service");

const financeService = require(
  "../services/super-admin-finance.service"
);

const couponService = require(
  "../services/pro-coupon.service"
);

const {
  createSuperAdminFinanceCreditHandler,
} = require("./super-admin-finance-credit.handler");

const {
  createSuperAdminFinancePricingHandler,
} = require("./super-admin-finance-pricing.handler");

const {
  createSuperAdminFinanceCouponReportHandler,
} = require("./super-admin-finance-coupon-report.handler");

const couponCreationFlow = new Map();

const COUPON_FLOW_TTL_MS = 10 * 60 * 1000;
const MAX_COUPON_USES = 2147483647;

const COUPON_NAVIGATION_BUTTONS = [
  "💰 مالی",
  "💳 تراکنش‌ها",
  "💳 مدیریت اعتبار",
  "💎 مدیریت Pro",
  "⭐ درآمد Pro",
  "🔄 تازه‌سازی درآمد Pro",
  "🏷️ تخفیف عمومی Pro",
  "📊 مشاهده قیمت پلن‌ها",
  "💰 تغییر قیمت پلن‌ها",
  "✏️ تغییر تخفیف عمومی",
  "🎟️ کدهای تخفیف",
  "➕ ساخت کد تخفیف",
  "📋 مشاهده کدهای تخفیف",
  "🔄 تازه‌سازی کدها",
  "🔙 مدیریت کدهای تخفیف",
  "🔙 مشاهده کدهای تخفیف",
  "💰 درآمدها",
  "💸 هزینه‌ها",
  "📊 گزارش مالی",
  "🔙 بخش مالی",
  "🔙 پنل Super Admin",
  "👥 کاربران",
  "🔙 پنل مدیریت",
];

function getCouponCreationState(telegramUserId) {
  const state = couponCreationFlow.get(telegramUserId);

  if (!state) {
    return null;
  }

  if (
    !state.updatedAt ||
    Date.now() - state.updatedAt > COUPON_FLOW_TTL_MS
  ) {
    couponCreationFlow.delete(telegramUserId);
    return null;
  }

  return state;
}

function updateCouponCreationState(telegramUserId, state) {
  couponCreationFlow.set(telegramUserId, {
    ...state,
    updatedAt: Date.now(),
  });
}

function clearCouponCreationState(telegramUserId) {
  couponCreationFlow.delete(telegramUserId);
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

function buildFinanceMenu() {
  return Markup.keyboard([
    ["💳 تراکنش‌ها"],
    ["💳 مدیریت اعتبار", "💎 مدیریت Pro"],
    ["⭐ درآمد Pro"],
    ["🏷️ تخفیف عمومی Pro"],
    ["🎟️ کدهای تخفیف"],
    ["💰 درآمدها", "💸 هزینه‌ها"],
    ["📊 گزارش مالی"],
    ["🔙 پنل Super Admin"],
  ])
    .resize()
    .oneTime(false);
}

function buildCouponMenu() {
  return Markup.keyboard([
    ["➕ ساخت کد تخفیف"],
    ["📋 مشاهده کدهای تخفیف"],
    ["🔙 بخش مالی"],
  ])
    .resize()
    .oneTime(false);
}

function formatAmount(amount, currency) {
  const value = Number(amount || 0);

  return (
    new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(value) +
    " " +
    String(currency || "")
  ).trim();
}

function formatDate(date) {
  if (!date) {
    return "ثبت نشده";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "نامشخص";
  }

  return parsed.toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (digit) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    )
    .replace(/[٠-٩]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    );
}

function parseIntegerInput(value) {
  const normalized = normalizeDigits(value).trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const number = Number(normalized);

  if (!Number.isSafeInteger(number)) {
    return null;
  }

  return number;
}

function parseCouponDate(dateText, endOfDay = false) {
  const normalized = normalizeDigits(dateText).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const [year, month, day] = normalized
    .split("-")
    .map(Number);

  const calendarDate = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }

  const time = endOfDay
    ? "23:59:59.999"
    : "00:00:00.000";

  const offset = "+03:30";

  const result = new Date(
    `${normalized}T${time}${offset}`
  );

  if (Number.isNaN(result.getTime())) {
    return null;
  }

  return result;
}

function getStatusLabel(status) {
  const labels = {
    SUCCESS: "🟢 موفق",
    SUCCEEDED: "🟢 موفق",
    PAID: "🟢 پرداخت‌شده",
    COMPLETED: "🟢 تکمیل‌شده",
    VERIFIED: "🟢 تأییدشده",
    ACTIVE: "🟢 فعال",
    PENDING: "🟡 در انتظار",
    PROCESSING: "🟡 در حال پردازش",
    FAILED: "🔴 ناموفق",
    REJECTED: "🔴 ردشده",
    CANCELLED: "⚫ لغوشده",
    EXPIRED: "⚫ منقضی‌شده",
    REFUNDED: "↩️ بازپرداخت‌شده",
  };

  const normalized = String(status || "")
    .trim()
    .toUpperCase();

  return labels[normalized] || `❔ ${status || "نامشخص"}`;
}

// --------------------------------------------------
// Finance menu
// --------------------------------------------------

async function handleFinanceMenu(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ فقط Super Admin به بخش مالی دسترسی دارد."
    );
    return;
  }

  clearCouponCreationState(ctx.from.id);

  await ctx.reply(
    "💰 مدیریت مالی زکا\n\n" +
      "مدیریت پرداخت‌ها، اعتبار کاربران و اشتراک‌های Pro از این بخش انجام می‌شود.\n\n" +
      "💳 تراکنش‌ها: مشاهده تراکنش‌های ثبت‌شده\n" +
      "💳 مدیریت اعتبار: افزودن، کسر و مشاهده اعتبار\n" +
      "💎 مدیریت Pro: فعال‌سازی، تمدید و بررسی خریدها\n" +
      "⭐ درآمد Pro: گزارش درآمد اشتراک‌ها\n" +
      "🏷️ تخفیف عمومی Pro: تنظیم درصد تخفیف همه پلن‌ها\n" +
      "🎟️ کدهای تخفیف: ساخت و مدیریت کدهای خرید Pro\n\n" +
      "یک بخش را انتخاب کن.",
    buildFinanceMenu()
  );
}

// --------------------------------------------------
// Transactions
// --------------------------------------------------

async function handleTransactions(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ فقط Super Admin به تراکنش‌ها دسترسی دارد."
    );
    return;
  }

  try {
    const [transactions, total] = await Promise.all([
      financeService.getLatestTransactions(10),
      financeService.getTransactionCount(),
    ]);

    if (!transactions.length) {
      await ctx.reply(
        "💳 تراکنش‌ها\n\n" +
          "هنوز هیچ تراکنشی در جدول پرداخت ثبت نشده است.\n\n" +
          `📊 تعداد کل تراکنش‌ها: ${total}\n\n` +
          "توجه: درخواست‌های خرید دستی Pro فعلاً به‌عنوان تراکنش مالی ثبت نمی‌شوند.",
        buildFinanceMenu()
      );

      return;
    }

    const lines = transactions.map((item, index) => {
      const userName = item.username
        ? `@${item.username}`
        : item.display_name || "بدون نام";

      return (
        `${index + 1}. 💳 تراکنش ${item.transaction_id}\n` +
        `👤 ${userName}\n` +
        `🆔 Telegram ID: ${item.telegram_user_id}\n` +
        `📦 نوع پرداخت: ${item.payment_type || "نامشخص"}\n` +
        `🔹 نوع تراکنش: ${item.transaction_type || "نامشخص"}\n` +
        `💰 مبلغ: ${formatAmount(
          item.transaction_amount,
          item.transaction_currency
        )}\n` +
        `📌 وضعیت تراکنش: ${getStatusLabel(
          item.transaction_status
        )}\n` +
        `📌 وضعیت پرداخت: ${getStatusLabel(
          item.payment_status
        )}\n` +
        `🏦 درگاه: ${item.provider || "ثبت نشده"}\n` +
        `🧾 شماره مرجع: ${item.reference_number || "ثبت نشده"}\n` +
        `📅 زمان ثبت: ${formatDate(
          item.transaction_created_at
        )}\n` +
        `✅ زمان تأیید: ${formatDate(item.verified_at)}`
      );
    });

    await ctx.reply(
      "💳 آخرین تراکنش‌ها\n\n" +
        `📊 تعداد کل تراکنش‌ها: ${total}\n` +
        "━━━━━━━━━━━━━━\n\n" +
        lines.join("\n\n━━━━━━━━━━━━━━\n\n"),
      buildFinanceMenu()
    );
  } catch (error) {
    console.error(
      "Super Admin transactions failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت تراکنش‌ها انجام نشد. خطای دیتابیس را بررسی کن.",
      buildFinanceMenu()
    );
  }
}

// --------------------------------------------------
// Pro revenue
// --------------------------------------------------

async function handleProRevenue(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ فقط Super Admin به گزارش درآمد دسترسی دارد."
    );
    return;
  }

  try {
    const [summary, sales] = await Promise.all([
      financeService.getProRevenueSummary(),
      financeService.getLatestProSales(10),
    ]);

    const totalRevenue = formatAmount(
      summary.totalRevenue,
      "تومان"
    );

    const todayRevenue = formatAmount(
      summary.todayRevenue,
      "تومان"
    );

    const monthRevenue = formatAmount(
      summary.currentMonthRevenue,
      "تومان"
    );

    let message =
      "⭐ گزارش درآمد اشتراک Pro\n\n" +
      "💰 درآمد کل: " + totalRevenue + "\n" +
      "📅 درآمد امروز: " + todayRevenue + "\n" +
      "🗓 درآمد ماه جاری: " + monthRevenue + "\n\n" +
      "━━━━━━━━━━━━━━\n" +
      "📊 آمار فروش\n\n" +
      `🛒 تعداد کل فروش: ${summary.paidSubscriptionCount}\n` +
      `📅 فروش امروز: ${summary.todaySubscriptionCount}\n` +
      `🗓 فروش ماه جاری: ${summary.currentMonthSubscriptionCount}\n\n`;

    if (summary.zeroPriceSubscriptionCount > 0) {
      message +=
        "ℹ️ اشتراک‌های بدون مبلغ ثبت‌شده: " +
        `${summary.zeroPriceSubscriptionCount}\n\n`;
    }

    message += "━━━━━━━━━━━━━━\n";
    message += "🧾 آخرین خریدهای Pro\n\n";

    if (!sales.length) {
      message += "هنوز خرید پولی Pro ثبت نشده است.";
    } else {
      const salesLines = sales.map((item, index) => {
        const userName = item.username
          ? `@${item.username}`
          : item.display_name || "بدون نام";

        const duration = Number(
          item.duration_months || 0
        );

        return (
          `${index + 1}. ⭐ اشتراک Pro\n` +
          `👤 کاربر: ${userName}\n` +
          `🆔 Telegram ID: ${item.telegram_user_id}\n` +
          `📦 مدت اشتراک: ${duration} ماه\n` +
          `💰 مبلغ: ${formatAmount(item.price, "تومان")}\n` +
          `📌 وضعیت: ${getStatusLabel(item.status)}\n` +
          `📅 زمان خرید: ${formatDate(item.created_at)}\n` +
          `⏰ پایان اشتراک: ${formatDate(item.expires_at)}`
        );
      });

      message += salesLines.join(
        "\n\n━━━━━━━━━━━━━━\n\n"
      );
    }

    await ctx.reply(
      message,
      Markup.keyboard([
        ["🔄 تازه‌سازی درآمد Pro"],
        ["🔙 بخش مالی"],
      ])
        .resize()
        .oneTime(false)
    );
  } catch (error) {
    console.error(
      "Pro revenue report failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت گزارش درآمد Pro انجام نشد.\n\n" +
        "خطای دیتابیس یا سرویس مالی را بررسی کن.",
      buildFinanceMenu()
    );
  }
}

// --------------------------------------------------
// Coupon menu
// --------------------------------------------------

async function handleCouponMenu(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply("⛔ دسترسی غیرمجاز.");
    return;
  }

  clearCouponCreationState(ctx.from.id);

  await ctx.reply(
    "🎟️ مدیریت کدهای تخفیف Pro\n\n" +
      "از این بخش می‌توانی کد تخفیف بسازی، میزان تخفیف را تعیین کنی و کدهای قبلی را مدیریت کنی.\n\n" +
      "درصد تخفیف هر کد بین ۱ تا ۹۰ درصد است.",
    buildCouponMenu()
  );
}

async function handleCreateCoupon(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply("⛔ دسترسی غیرمجاز.");
    return;
  }

  updateCouponCreationState(ctx.from.id, {
    step: "code",
    code: null,
    discountPercent: null,
    maxUses: null,
    startsAt: null,
    expiresAt: null,
  });

  await ctx.reply(
    "➕ ساخت کد تخفیف\n\n" +
      "نام کد تخفیف را وارد کن.\n\n" +
      "مثال: ZEKA20\n\n" +
      "فقط حروف انگلیسی، عدد، خط تیره و زیرخط مجاز است.",
    Markup.keyboard([
      ["❌ لغو ساخت کد"],
    ])
      .resize()
      .oneTime(false)
  );
}

// --------------------------------------------------
// Coupon list
// --------------------------------------------------

async function handleCouponList(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply("⛔ دسترسی غیرمجاز.");
    return;
  }

  clearCouponCreationState(ctx.from.id);

  try {
    const coupons = await couponService.listCoupons({
      limit: 30,
      offset: 0,
    });

    if (!coupons.length) {
      await ctx.reply(
        "📋 هنوز هیچ کد تخفیفی ساخته نشده است.",
        buildCouponMenu()
      );

      return;
    }

    const messages = [];
    const buttons = [];

    for (const coupon of coupons) {
      const active = Boolean(coupon.is_active);

      const maxUses =
        coupon.max_uses === null
          ? "نامحدود"
          : Number(coupon.max_uses);

      const usedCount = Number(
        coupon.actual_usage_count ??
        coupon.usage_count ??
        0
      );

      messages.push(
        `🎟️ کد: ${coupon.code}\n` +
          `🏷️ تخفیف: ${coupon.discount_percent}٪\n` +
          `📊 استفاده: ${usedCount} از ${maxUses}\n` +
          `📅 شروع: ${formatDate(coupon.starts_at)}\n` +
          `⏰ انقضا: ${formatDate(coupon.expires_at)}\n` +
          `📌 وضعیت: ${active ? "🟢 فعال" : "🔴 غیرفعال"}\n` +
          `🆔 شناسه: ${coupon.id}`
      );

      buttons.push([
        `${active ? "🔴 غیرفعال‌کردن" : "🟢 فعال‌کردن"} کد ${coupon.id}`,
      ]);

      buttons.push([
        `👥 کاربران کد ${coupon.id}`,
      ]);
    }

    buttons.push(
      ["🔄 تازه‌سازی کدها"],
      ["🔙 مدیریت کدهای تخفیف"]
    );

    await ctx.reply(
      "📋 فهرست کدهای تخفیف\n\n" +
        messages.join("\n\n━━━━━━━━━━━━━━\n\n"),
      Markup.keyboard(buttons)
        .resize()
        .oneTime(false)
    );
  } catch (error) {
    console.error("Coupon list failed:", error);

    await ctx.reply(
      "❌ دریافت فهرست کدهای تخفیف انجام نشد.",
      buildCouponMenu()
    );
  }
}

// --------------------------------------------------
// Coupon activation / deactivation
// --------------------------------------------------

async function handleCouponToggle(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply("⛔ دسترسی غیرمجاز.");
    return;
  }

  const text = String(
    ctx.message?.text || ""
  ).trim();

  const match = text.match(
    /^(🟢 فعال‌کردن|🔴 غیرفعال‌کردن) کد (\d+)$/
  );

  if (!match) {
    return;
  }

  const isActive = match[1] === "🟢 فعال‌کردن";
  const couponId = Number(match[2]);

  try {
    const coupon = await couponService.setCouponActive({
      couponId,
      isActive,
    });

    if (!coupon) {
      await ctx.reply(
        "❌ کد تخفیف موردنظر پیدا نشد."
      );

      return;
    }

    await ctx.reply(
      `${isActive ? "🟢 کد فعال شد" : "🔴 کد غیرفعال شد"}\n\n` +
        `🎟️ ${coupon.code}`
    );

    await handleCouponList(ctx);
  } catch (error) {
    console.error("Coupon status update failed:", error);

    await ctx.reply(
      "❌ تغییر وضعیت کد تخفیف انجام نشد."
    );
  }
}

// --------------------------------------------------
// Coupon creation flow
// --------------------------------------------------

async function handleCouponCreationText(ctx, text, state) {
  const telegramUserId = ctx.from.id;

  if (state.step === "code") {
    try {
      state.code = couponService.validateCode(text);
      state.step = "discount";

      updateCouponCreationState(
        telegramUserId,
        state
      );

      await ctx.reply(
        "🏷️ درصد تخفیف را وارد کن.\n\n" +
          "عدد باید بین ۱ تا ۹۰ باشد.\n" +
          "مثال: ۲۰"
      );
    } catch (error) {
      await ctx.reply(
        "❌ نام کد معتبر نیست.\n" +
          "از حروف انگلیسی، عدد، خط تیره یا زیرخط استفاده کن."
      );
    }

    return;
  }

  if (state.step === "discount") {
    const discount = parseIntegerInput(text);

    if (
      discount === null ||
      discount < 1 ||
      discount > 90
    ) {
      await ctx.reply(
        "❌ درصد تخفیف باید عددی بین ۱ تا ۹۰ باشد."
      );

      return;
    }

    state.discountPercent = discount;
    state.step = "max_uses";

    updateCouponCreationState(
      telegramUserId,
      state
    );

    await ctx.reply(
      "📊 سقف تعداد استفاده از کد را وارد کن.\n\n" +
        "مثال: ۱۰۰\n\n" +
        "اگر محدودیت نمی‌خواهی، دکمه زیر را بزن.",
      Markup.keyboard([
        ["♾️ بدون محدودیت استفاده"],
        ["❌ لغو ساخت کد"],
      ])
        .resize()
        .oneTime(false)
    );

    return;
  }

  if (state.step === "max_uses") {
    if (text === "♾️ بدون محدودیت استفاده") {
      state.maxUses = null;
    } else {
      const maxUses = parseIntegerInput(text);

      if (
        maxUses === null ||
        maxUses < 1 ||
        maxUses > MAX_COUPON_USES
      ) {
        await ctx.reply(
          "❌ سقف استفاده باید عدد صحیح بین ۱ تا ۲٬۱۴۷٬۴۸۳٬۶۴۷ باشد."
        );

        return;
      }

      state.maxUses = maxUses;
    }

    state.step = "starts_at";

    updateCouponCreationState(
      telegramUserId,
      state
    );

    await ctx.reply(
      "📅 تاریخ شروع اعتبار کد را وارد کن.\n\n" +
        "فرمت: YYYY-MM-DD\n" +
        "مثال: 2026-12-01\n\n" +
        "اگر کد از همین الان فعال باشد، گزینه زیر را بزن.",
      Markup.keyboard([
        ["🟢 شروع از همین الان"],
        ["❌ لغو ساخت کد"],
      ])
        .resize()
        .oneTime(false)
    );

    return;
  }

  if (state.step === "starts_at") {
    if (text === "🟢 شروع از همین الان") {
      state.startsAt = null;
    } else {
      const date = parseCouponDate(text);

      if (!date) {
        await ctx.reply(
          "❌ تاریخ معتبر نیست.\n" +
            "از فرمت YYYY-MM-DD استفاده کن."
        );

        return;
      }

      state.startsAt = date.toISOString();
    }

    state.step = "expires_at";

    updateCouponCreationState(
      telegramUserId,
      state
    );

    await ctx.reply(
      "⏰ تاریخ انقضای کد را وارد کن.\n\n" +
        "فرمت: YYYY-MM-DD\n" +
        "مثال: 2026-12-31\n\n" +
        "اگر کد تاریخ انقضا ندارد، گزینه زیر را بزن.",
      Markup.keyboard([
        ["♾️ بدون تاریخ انقضا"],
        ["❌ لغو ساخت کد"],
      ])
        .resize()
        .oneTime(false)
    );

    return;
  }

  if (state.step === "expires_at") {
    if (text === "♾️ بدون تاریخ انقضا") {
      state.expiresAt = null;
    } else {
      const date = parseCouponDate(text, true);

      if (!date) {
        await ctx.reply(
          "❌ تاریخ معتبر نیست. از فرمت YYYY-MM-DD استفاده کن."
        );

        return;
      }

      if (date <= new Date()) {
        await ctx.reply(
          "❌ تاریخ انقضا باید در آینده باشد."
        );

        return;
      }

      state.expiresAt = date.toISOString();
    }

    if (
      state.startsAt &&
      state.expiresAt &&
      new Date(state.expiresAt) <=
        new Date(state.startsAt)
    ) {
      await ctx.reply(
        "❌ تاریخ انقضا باید بعد از تاریخ شروع باشد."
      );

      return;
    }

    try {
      const coupon = await couponService.createCoupon({
        code: state.code,
        discountPercent: state.discountPercent,
        maxUses: state.maxUses,
        startsAt: state.startsAt,
        expiresAt: state.expiresAt,
        createdBy: telegramUserId,
      });

      clearCouponCreationState(telegramUserId);

      await ctx.reply(
        "✅ کد تخفیف با موفقیت ساخته شد.\n\n" +
          `🎟️ کد: ${coupon.code}\n` +
          `🏷️ درصد تخفیف: ${coupon.discount_percent}٪\n` +
          `📊 سقف استفاده: ${
            coupon.max_uses === null
              ? "نامحدود"
              : coupon.max_uses
          }\n` +
          `📅 شروع اعتبار: ${formatDate(coupon.starts_at)}\n` +
          `⏰ انقضا: ${formatDate(coupon.expires_at)}\n` +
          "📌 وضعیت: 🟢 فعال",
        buildCouponMenu()
      );
    } catch (error) {
      console.error("Coupon creation failed:", error);

      if (
        error.code === "COUPON_CODE_ALREADY_EXISTS" ||
        error.code === "23505"
      ) {
        state.step = "code";

        updateCouponCreationState(
          telegramUserId,
          state
        );

        await ctx.reply(
          "❌ این کد قبلاً ساخته شده است.\n\nیک کد دیگر وارد کن."
        );

        return;
      }

      clearCouponCreationState(telegramUserId);

      await ctx.reply(
        "❌ ساخت کد تخفیف انجام نشد.",
        buildCouponMenu()
      );
    }
  }
}

// --------------------------------------------------
// Coupon flow middleware
// --------------------------------------------------

async function handleCouponCreationInput(ctx, next) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return next();
  }

  const state = getCouponCreationState(
    telegramUserId
  );

  if (!state) {
    return next();
  }

  const text = String(
    ctx.message?.text || ""
  ).trim();

  if (text === "❌ لغو ساخت کد") {
    clearCouponCreationState(telegramUserId);

    await ctx.reply(
      "ساخت کد تخفیف لغو شد.",
      buildCouponMenu()
    );

    return;
  }

  if (
    COUPON_NAVIGATION_BUTTONS.includes(text) ||
    text.startsWith("🔴 غیرفعال‌کردن کد ") ||
    text.startsWith("🟢 فعال‌کردن کد ") ||
    text.startsWith("👥 کاربران کد ")
  ) {
    clearCouponCreationState(telegramUserId);
    return next();
  }

  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    clearCouponCreationState(telegramUserId);

    await ctx.reply(
      "⛔ دسترسی غیرمجاز."
    );

    return;
  }

  try {
    await handleCouponCreationText(
      ctx,
      text,
      state
    );
  } catch (error) {
    console.error(
      "Coupon creation input failed:",
      error
    );

    clearCouponCreationState(telegramUserId);

    await ctx.reply(
      "❌ خطا در ساخت کد تخفیف.",
      buildCouponMenu()
    );
  }
}

// --------------------------------------------------
// Other finance sections
// --------------------------------------------------

async function handleUnimplementedFinanceSection(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply("⛔ دسترسی غیرمجاز.");
    return;
  }

  await ctx.reply(
    "⏳ این قسمت در مرحله بعد پیاده‌سازی می‌شود.",
    buildFinanceMenu()
  );
}

// --------------------------------------------------
// Register handlers
// --------------------------------------------------

function createSuperAdminFinanceHandler(bot) {
  // ابتدا جریان ساخت کوپن ثبت می‌شود تا بتواند
  // خروج از جریان را قبل از اجرای منوها تشخیص دهد.
  bot.on(
    "text",
    handleCouponCreationInput
  );

  createSuperAdminFinanceCreditHandler(bot);
  createSuperAdminFinancePricingHandler(bot);
  createSuperAdminFinanceCouponReportHandler(bot);

  bot.hears(
    "💰 مالی",
    handleFinanceMenu
  );

  bot.hears(
    "💳 تراکنش‌ها",
    handleTransactions
  );

  bot.hears(
    "🔙 بخش مالی",
    handleFinanceMenu
  );

  bot.hears(
    "🎟️ کدهای تخفیف",
    handleCouponMenu
  );

  bot.hears(
    "➕ ساخت کد تخفیف",
    handleCreateCoupon
  );

  bot.hears(
    "📋 مشاهده کدهای تخفیف",
    handleCouponList
  );

  bot.hears(
    "🔄 تازه‌سازی کدها",
    handleCouponList
  );

  bot.hears(
    "🔙 مدیریت کدهای تخفیف",
    handleCouponMenu
  );

  bot.hears(
    "🔙 مشاهده کدهای تخفیف",
    handleCouponList
  );

  bot.hears(
    /^(🟢 فعال‌کردن|🔴 غیرفعال‌کردن) کد \d+$/,
    handleCouponToggle
  );

  bot.hears(
    "⭐ درآمد Pro",
    handleProRevenue
  );

  bot.hears(
    "🔄 تازه‌سازی درآمد Pro",
    handleProRevenue
  );

  bot.hears(
    /^(💰 درآمدها|💸 هزینه‌ها|📊 گزارش مالی)$/,
    handleUnimplementedFinanceSection
  );
}

module.exports = {
  createSuperAdminFinanceHandler,
};
