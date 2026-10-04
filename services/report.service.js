const adminManagementRepository = require(
  "../repositories/admin-management.repository"
);

let bot = null;

function setBot(nextBot) {
  bot = nextBot;
}

async function sendDownloadReport({
  user,
  report,
  originalUrl,
  jobId,
}) {
  const reportAdmins =
    await adminManagementRepository.getActiveAdminsWithPermission(
      "bug_reports"
    );

  const reportData = {
    userId:
      user?.telegram_user_id ||
      user?.telegramUserId ||
      "نامشخص",

    username:
      user?.username
        ? `@${user.username}`
        : "ندارد",

    displayName:
      user?.display_name ||
      user?.displayName ||
      "ثبت نشده",

    report:
      String(report || "").trim(),

    originalUrl:
      originalUrl || "ثبت نشده",

    jobId:
      jobId || "نامشخص",
  };

  console.log(
    "Download report received:",
    reportData
  );

  if (!bot) {
    console.error(
      "Download report cannot be sent: bot is not configured"
    );

    return {
      sent: false,
      reason: "BOT_NOT_CONFIGURED",
    };
  }

  if (!reportAdmins.length) {
    console.warn(
      "No active admin has bug_reports permission"
    );

    return {
      sent: false,
      reason: "REPORT_ADMIN_NOT_CONFIGURED",
    };
  }

  const message =
    "🐞 گزارش مشکل دانلود\n\n" +
    `👤 کاربر: ${reportData.displayName}\n` +
    `🆔 Telegram ID: ${reportData.userId}\n` +
    `🔹 Username: ${reportData.username}\n\n` +
    `📝 مشکل:\n${reportData.report}\n\n` +
    `🔗 لینک:\n${reportData.originalUrl}\n\n` +
    `🧾 Job ID: ${reportData.jobId}`;

  const sentTo = [];
  const failed = [];

  for (const admin of reportAdmins) {
    try {
      await bot.telegram.sendMessage(
        String(admin.telegram_user_id),
        message
      );

      sentTo.push(
        String(admin.telegram_user_id)
      );
    } catch (error) {
      failed.push({
        adminId:
          String(admin.telegram_user_id),
        error,
      });

      console.error(
        `Failed to send download report to admin ${admin.telegram_user_id}:`,
        error
      );
    }
  }

  console.log(
    "Download report sent to admins:",
    sentTo
  );

  return {
    sent: sentTo.length > 0,
    adminIds: sentTo,
    failed,
  };
}

module.exports = {
  setBot,
  sendDownloadReport,
};
