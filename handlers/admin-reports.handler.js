const {
  Markup,
} = require("telegraf");

const {
  requirePermissionByTelegramId,
} = require("../services/admin-management.service");

async function handleAdminReports(ctx) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  try {
    await requirePermissionByTelegramId(
      telegramUserId,
      "reports"
    );

    await ctx.reply(
      "📋 گزارش‌ها\n\n" +
      "🚨 گزارش‌های سؤالات را از بخش مسابقه مدیریت کنید.",
      Markup.keyboard([
        ["🧠 مدیریت مسابقه"],
        ["🔙 پنل ادمین"],
      ]).resize()
    );
  } catch (error) {
    console.error(
      "Admin reports access failed:",
      error
    );

    await ctx.reply(
      "❌ شما دسترسی مشاهده گزارش‌ها را ندارید."
    );
  }
}

function createAdminReportsHandler(bot) {
  bot.hears(
    "📋 گزارش‌ها",
    handleAdminReports
  );
}

module.exports = {
  createAdminReportsHandler,
};
