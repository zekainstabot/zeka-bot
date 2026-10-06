const {
  sendPendingReports,
} = require("./admin-quiz/reports.handler");

const adminManagementService = require(
  "../services/admin-management.service"
);

async function handleAdminQuestionReports(ctx) {
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
      "Admin question reports handler failed:",
      error
    );

    try {
      await ctx.reply(
        "❌ دریافت گزارش‌های سؤالات انجام نشد."
      );
    } catch {}
  }
}

function createAdminReportsHandler(bot) {
  bot.hears(
    "🧠 گزارش سؤالات",
    handleAdminQuestionReports
  );
}

module.exports = {
  createAdminReportsHandler,
};
