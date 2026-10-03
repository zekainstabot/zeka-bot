const {
  Markup,
} = require("telegraf");

async function quizAdminMenu(
  ctx,
  adminQuizService
) {
  const telegramUserId =
    ctx.from?.id;

  let isSuperAdmin = false;

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
  }

  return Markup.keyboard([
    ["➕ افزودن سؤال"],
    ["📚 بانک سؤالات"],
["📥 ورود سؤال از سایت"],
    ["🚨 گزارش‌های سؤالات"],
    [
      isSuperAdmin
        ? "🔙 پنل Super Admin"
        : "🔙 پنل مدیریت",
    ],
  ]).resize();
}

module.exports = {
  quizAdminMenu,
};
