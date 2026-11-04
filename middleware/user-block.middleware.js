
const { getClient } = require("../database/client");
const adminService = require("../services/admin.service");

async function userBlockMiddleware(ctx, next) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return next();
  }

  try {
    // حساب‌های مدیریتی فعال نباید با این سیستم قفل شوند.
    const admin = await adminService.getAdminByTelegramId(
      telegramUserId
    );

    if (admin && admin.is_active) {
      return next();
    }

    const db = getClient();

    const result = await db.query(
      `SELECT is_blocked
       FROM users
       WHERE telegram_user_id = $1
       LIMIT 1`,
      [String(telegramUserId)]
    );

    // کاربر جدید هنوز در دیتابیس ثبت نشده است.
    // اجازه می‌دهیم /start حساب او را ایجاد کند.
    if (!result.rows.length) {
      return next();
    }

    if (result.rows[0].is_blocked) {
      await ctx.reply(
        "⛔ حساب شما مسدود شده است و امکان استفاده از ربات را ندارید."
      );

      return;
    }

    return next();
  } catch (error) {
    console.error("User block middleware failed:", error);

    // خطای دیتابیس نباید کل ربات را از دسترس خارج کند.
    return next();
  }
}

module.exports = {
  userBlockMiddleware,
};
