const {
  sendPendingReports,
} = require("./admin-quiz/reports.handler");

const adminManagementService = require(
  "../services/admin-management.service"
);

async function handleAdminReports(ctx) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  try {
    await adminManagementService.requirePermissionByTelegramId(
      telegramUserId,
      "reports"
    );

    await sendPendingReports(
      ctx,
      telegramUserId,
      0,
      null
    );
  } catch (error) {
    console.error(
      "Admin reports handler failed:",
      error
    );

    try {
      await ctx.reply(
        "❌ دریافت گزارش‌ها انجام نشد."
      );
    } catch {}
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
