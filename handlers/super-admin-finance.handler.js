
const { Markup } = require("telegraf");

const adminService = require("../services/admin.service");

const financeService = require(
  "../services/super-admin-finance.service"
);

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
    ["💳 تراکنش‌ها", "⭐ درآمد Pro"],
    ["💰 درآمدها", "💸 هزینه‌ها"],
    ["📊 گزارش مالی"],
    ["🔙 پنل Super Admin"],
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

function getStatusLabel(status) {
  const labels = {
    SUCCESS: "🟢 موفق",
    SUCCEEDED: "🟢 موفق",
    PAID: "🟢 پرداخت‌شده",
    COMPLETED: "🟢 تکمیل‌شده",
    VERIFIED: "🟢 تأییدشده",

    PENDING: "🟡 در انتظار",
    PROCESSING: "🟡 در حال پردازش",

    FAILED: "🔴 ناموفق",
    REJECTED: "🔴 ردشده",
    CANCELLED: "⚫ لغوشده",
    REFUNDED: "↩️ بازپرداخت‌شده",
  };

  const normalized = String(status || "")
    .trim()
    .toUpperCase();

  return labels[normalized] || `❔ ${status || "نامشخص"}`;
}

async function handleFinanceMenu(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ فقط Super Admin به بخش مالی دسترسی دارد."
    );
    return;
  }

  await ctx.reply(
    "💰 مدیریت مالی زکا\n\n" +
      "از این بخش می‌توانی تراکنش‌ها و گزارش‌های مالی را بررسی کنی.\n\n" +
      "📌 بخش‌ها:\n" +
      "💳 تراکنش‌ها\n" +
      "⭐ درآمد Pro\n" +
      "💰 درآمدها\n" +
      "💸 هزینه‌ها\n" +
      "📊 گزارش مالی\n\n" +
      "یک بخش را انتخاب کن.",
    buildFinanceMenu()
  );
}

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

async function handleUnimplementedFinanceSection(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ دسترسی غیرمجاز."
    );
    return;
  }

  await ctx.reply(
    "⏳ این بخش هنوز پیاده‌سازی نشده است.",
    buildFinanceMenu()
  );
}

function createSuperAdminFinanceHandler(bot) {
  bot.hears(
    "💰 مالی",
    handleFinanceMenu
  );

  bot.hears(
    "💳 تراکنش‌ها",
    handleTransactions
  );

  bot.hears(
    /^(⭐ درآمد Pro|💰 درآمدها|💸 هزینه‌ها|📊 گزارش مالی)$/,
    handleUnimplementedFinanceSection
  );
}

module.exports = {
  createSuperAdminFinanceHandler,
};
