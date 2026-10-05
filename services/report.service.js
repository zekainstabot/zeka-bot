const adminManagementRepository = require(
  "../repositories/admin-management.repository"
);

const bugReportRepository = require(
  "../repositories/bug-report.repository"
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
      jobId || null,
  };

  console.log(
    "Download report received:",
    reportData
  );

  if (!reportData.report) {
    return {
      sent: false,
      reason: "EMPTY_REPORT",
    };
  }

  let savedReport = null;

  try {
    savedReport =
      await bugReportRepository.create({
        userId:
          user?.id || null,

        telegramUserId:
          reportData.userId,

        username:
          user?.username || null,

        displayName:
          reportData.displayName,

        report:
          reportData.report,

        originalUrl:
          reportData.originalUrl,

        jobId:
          reportData.jobId,

        status:
          "PENDING",
      });

    console.log(
      "Bug report saved:",
      savedReport?.id
    );
  } catch (error) {
    console.error(
      "Failed to save bug report:",
      error
    );

    return {
      sent: false,
      reason: "DATABASE_ERROR",
    };
  }

  if (!bot) {
    console.error(
      "Download report cannot be sent: bot is not configured"
    );

    return {
      sent: false,
      reason: "BOT_NOT_CONFIGURED",
      reportId:
        savedReport?.id || null,
    };
  }

  if (!reportAdmins.length) {
    console.warn(
      "No active admin has bug_reports permission"
    );

    return {
      sent: false,
      reason:
        "REPORT_ADMIN_NOT_CONFIGURED",
      reportId:
        savedReport?.id || null,
    };
  }

  const message =
    "🐞 گزارش مشکل دانلود\n\n" +
    `🆔 گزارش: ${savedReport.id}\n` +
    `👤 کاربر: ${reportData.displayName}\n` +
    `🆔 Telegram ID: ${reportData.userId}\n` +
    `🔹 Username: ${reportData.username}\n\n` +
    `📝 مشکل:\n${reportData.report}\n\n` +
    `🔗 لینک:\n${reportData.originalUrl}\n\n` +
    `🧾 Job ID: ${
      reportData.jobId || "ثبت نشده"
    }`;

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
    sent:
      sentTo.length > 0,

    adminIds:
      sentTo,

    failed,

    reportId:
      savedReport.id,
  };
}

module.exports = {
  setBot,
  sendDownloadReport,
};
