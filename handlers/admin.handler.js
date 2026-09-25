const {
  getAdminByTelegramId,
  getPermissions,
} = require("../services/admin.service");

async function handleAdminCommand(ctx) {
  try {
    const telegramUserId = ctx.from?.id;

    if (!telegramUserId) {
      return;
    }

    const admin =
      await getAdminByTelegramId(telegramUserId);

    if (!admin || !admin.is_active) {
      await ctx.reply(
        "⛔ شما دسترسی به پنل مدیریت ندارید."
      );
      return;
    }

    const permissions =
      await getPermissions(admin.user_id);

    const permissionText =
      permissions.length > 0
        ? permissions
            .map(
              (permission) =>
                `• ${permission.permission_key}`
            )
            .join("\n")
        : "هیچ Permission فعالی وجود ندارد.";

    await ctx.reply(
      `🛠️ پنل مدیریت زکا\n\n` +
        `👤 Role: ${admin.role_name}\n` +
        `🔑 سطح دسترسی: ${admin.role_key}\n\n` +
        `📋 دسترسی‌ها:\n${permissionText}`
    );
  } catch (error) {
    console.error(
      "Admin command failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت اطلاعات پنل مدیریت انجام نشد."
    );
  }
}

module.exports = {
  handleAdminCommand,
};
