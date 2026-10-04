const {
  Markup,
} = require("telegraf");

const adminQuizService = require(
  "../../services/admin-quiz.service"
);

const adminManagementService = require(
  "../../services/admin-management.service"
);

async function quizAdminMenu(
  ctx
) {
  const telegramUserId =
    ctx.from?.id;

  let isSuperAdmin = false;
  let canViewReports = false;

  if (telegramUserId) {
    try {
      const admin =
        await adminQuizService.requireQuizPermission(
          telegramUserId
        );

      isSuperAdmin =
        admin.role_key ===
        "super_admin";
    } catch {}

    try {
      await adminManagementService.requirePermissionByTelegramId(
        telegramUserId,
        "reports.view"
      );

      canViewReports = true;
    } catch {}
  }

  const buttons = [
    ["➕ افزودن سؤال"],
    ["📚 بانک سؤالات"],
    ["📥 ورود سؤال از سایت"],
  ];

  if (canViewReports) {
    buttons.push([
      "🚨 گزارش‌های سؤالات",
    ]);
  }

  buttons.push([
    isSuperAdmin
      ? "🔙 پنل Super Admin"
      : "🔙 پنل مدیریت",
  ]);

  return Markup.keyboard(
    buttons
  ).resize();
}

module.exports = {
  quizAdminMenu,
};
