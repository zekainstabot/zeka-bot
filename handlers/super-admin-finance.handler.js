
const { Markup } = require("telegraf");
const adminService = require("../services/admin.service");

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
    "از این بخش می‌توانی درآمدها، هزینه‌ها و تراکنش‌های مالی ربات را مدیریت و بررسی کنی.\n\n" +
    "📌 بخش‌های مالی:\n" +
    "💳 تراکنش‌ها\n" +
    "⭐ درآمد اشتراک Pro\n" +
    "💰 درآمدها\n" +
    "💸 هزینه‌ها\n" +
    "📊 گزارش مالی\n\n" +
    "یک بخش را انتخاب کن.",
    buildFinanceMenu()
  );
}

function createSuperAdminFinanceHandler(bot) {
  bot.hears(
    "💰 مالی",
    handleFinanceMenu
  );

  bot.hears(
    /^(💳 تراکنش‌ها|⭐ درآمد Pro|💰 درآمدها|💸 هزینه‌ها|📊 گزارش مالی)$/,
    async (ctx) => {
      const admin = await getSuperAdmin(ctx);

      if (!admin) {
        await ctx.reply(
          "⛔ دسترسی غیرمجاز."
        );
        return;
      }

      await ctx.reply(
        "⏳ این قسمت در مرحله بعد پیاده‌سازی می‌شود.",
        buildFinanceMenu()
      );
    }
  );
}

module.exports = {
  createSuperAdminFinanceHandler,
};
