const {
  getSetting,
} = require("./settings.service");

let bot = null;

function setBot(nextBot) {
  bot = nextBot;
}

async function getReportAdminId() {
  const value = await getSetting(
    "support.report_admin_id",
    ""
  );

  const adminId = String(value || "").trim();

  if (!adminId) {
    return null;
  }

  if (!/^\d+$/.test(adminId)) {
    return null;
  }

  return adminId;
}

async function sendDownloadReport({
  user,
  report,
  originalUrl,
  jobId,
}) {
  const adminId =
    await getReportAdminId();

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

  if (!adminId) {
    console.warn(
      "Download report admin is not configured"
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

  try {
    await bot.telegram.sendMessage(
      adminId,
      message
    );

    console.log(
      `Download report sent to admin: ${adminId}`
    );

    return {
      sent: true,
      adminId,
    };
  } catch (error) {
    console.error(
      "Failed to send download report to admin:",
      error
    );

    return {
      sent: false,
      reason: "SEND_FAILED",
      error,
    };
  }
}

module.exports = {
  setBot,
  getReportAdminId,
  sendDownloadReport,
};
