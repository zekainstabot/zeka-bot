const adminManagementService = require(
  "../services/admin-management.service"
);

const {
  createReportsHandler,
} = require("./admin-quiz/reports.handler");

async function handleAdminReports(
  ctx
) {
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
  } catch (error) {
    await ctx.reply(
      "❌ شما دسترسی مشاهده گزارش‌ها را ندارید."
    );

    return;
  }

  await sendQuizReports(
    ctx,
    telegramUserId
  );
}

async function sendQuizReports(
  ctx,
  telegramUserId
) {
  const {
    sendPendingReports,
  } = require("./admin-quiz/reports.handler");

  await sendPendingReports(
    ctx,
    telegramUserId
  );
}

function createAdminReportsHandler(
  bot
) {
  bot.hears(
    "📋 گزارش‌ها",
    handleAdminReports
  );
}

module.exports = {
  createAdminReportsHandler,
};
