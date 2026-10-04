const { Markup } = require("telegraf");

const adminService = require("../services/admin.service");
const userRepository = require("../repositories/user.repository");
const creditService = require("../services/credit.service");

const states = new Map();

const MENU = "👥 مدیریت کاربران";

function setState(userId, state) {
  states.set(String(userId), state);
}

function getState(userId) {
  return states.get(String(userId)) || null;
}

function clearState(userId) {
  states.delete(String(userId));
}

function mainMenu() {
  return Markup.keyboard([
    ["🔎 جستجوی کاربر"],
    ["📊 آمار کاربران"],
    ["🔙 پنل ادمین"],
  ]).resize();
}

function searchMenu() {
  return Markup.keyboard([
    ["❌ لغو"],
    ["🔙 مدیریت کاربران"],
  ]).resize();
}

async function requirePermission(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return null;
  }

  const admin =
    await adminService.getAdminByTelegramId(
      telegramUserId
    );

  if (!admin || !admin.is_active) {
    await ctx.reply(
      "⛔ حساب مدیریتی شما فعال نیست."
    );
    return null;
  }

  const allowed =
    await adminService.hasPermission(
      admin.user_id,
      "users"
    );

  if (!allowed) {
    await ctx.reply(
      "⛔ شما دسترسی مدیریت کاربران را ندارید."
    );
    return null;
  }

  return admin;
}

async function showUser(ctx, user) {
  if (!user) {
    await ctx.reply(
      "❌ کاربر پیدا نشد.",
      mainMenu()
    );
    return;
  }

  let balance = 0;

  try {
    balance =
      await creditService.getBalance(
        user.id
      );
  } catch (error) {
    console.error(
      "Admin user credit lookup failed:",
      error
    );
  }

  const username = user.username
    ? `@${user.username}`
    : "ثبت نشده";

  const name =
    user.display_name ||
    user.first_name ||
    "بدون نام";

  const proStatus =
    user.is_pro
      ? "🟢 فعال"
      : "🔴 غیرفعال";

  const text =
    "👤 اطلاعات کاربر\n\n" +
    `🆔 شناسه داخلی: ${user.id}\n` +
    `📱 Telegram ID: ${user.telegram_user_id}\n` +
    `👤 نام: ${name}\n` +
    `🔹 Username: ${username}\n` +
    `💳 اعتبار: ${balance}\n` +
    `💎 Pro: ${proStatus}\n` +
    `⭐ XP: ${user.xp || 0}\n` +
    `🏆 Level: ${user.level || 0}\n` +
    `🔥 Streak: ${user.streak_days || 0}\n` +
    `🌐 زبان: ${user.language || "fa"}\n` +
    `📅 ثبت‌نام: ${
      user.created_at || "نامشخص"
    }\n` +
    `🕐 آخرین فعالیت: ${
      user.last_active_at || "نامشخص"
    }`;

  await ctx.reply(
    text,
    mainMenu()
  );
}

async function searchUser(ctx, value) {
  const query = String(value || "").trim();

  if (!query) {
    await ctx.reply(
      "❌ مقدار جستجو خالی است."
    );
    return;
  }

  let user = null;

  try {
    if (/^\d+$/.test(query)) {
      user =
        await userRepository.findByTelegramId(
          query
        );

      if (!user) {
        user =
          await userRepository.findById(
            Number(query)
          );
      }
    } else {
      const username =
        query.startsWith("@")
          ? query.slice(1)
          : query;

      if (
        typeof userRepository.findByUsername ===
        "function"
      ) {
        user =
          await userRepository.findByUsername(
            username
          );
      }
    }

    await showUser(ctx, user);
  } catch (error) {
    console.error(
      "Admin user search failed:",
      error
    );

    await ctx.reply(
      "❌ جستجوی کاربر انجام نشد.",
      mainMenu()
    );
  }

  clearState(ctx.from.id);
}

async function showUserStats(ctx) {
  try {
    const db =
      require("../database/client").getClient();

    const result =
      await db.query(`
        SELECT
          COUNT(*)::int AS total_users,
          COUNT(*) FILTER (
            WHERE created_at >= CURRENT_DATE
          )::int AS today_users,
          COUNT(*) FILTER (
            WHERE last_active_at >= NOW() - INTERVAL '24 hours'
          )::int AS active_24h,
          COUNT(*) FILTER (
            WHERE is_pro = TRUE
          )::int AS pro_users
        FROM users
      `);

    const stats =
      result.rows[0] || {};

    await ctx.reply(
      "📊 آمار کاربران\n\n" +
        `👥 کل کاربران: ${stats.total_users || 0}\n` +
        `🆕 کاربران امروز: ${stats.today_users || 0}\n` +
        `🟢 فعال در ۲۴ ساعت اخیر: ${
          stats.active_24h || 0
        }\n` +
        `💎 کاربران Pro: ${stats.pro_users || 0}`,
      mainMenu()
    );
  } catch (error) {
    console.error(
      "Admin user stats failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت آمار کاربران انجام نشد.",
      mainMenu()
    );
  }
}

async function handleUserMenu(ctx) {
  if (!(await requirePermission(ctx))) {
    return;
  }

  clearState(ctx.from.id);

  await ctx.reply(
    "👥 مدیریت کاربران\n\n" +
      "عملیات موردنظر را انتخاب کنید.",
    mainMenu()
  );
}

async function handleSearchStart(ctx) {
  if (!(await requirePermission(ctx))) {
    return;
  }

  setState(ctx.from.id, {
    step: "searchUser",
  });

  await ctx.reply(
    "🔎 جستجوی کاربر\n\n" +
      "Telegram ID، شناسه داخلی یا Username کاربر را ارسال کنید.",
    searchMenu()
  );
}

async function handleBack(ctx) {
  clearState(ctx.from.id);
  await handleUserMenu(ctx);
}

async function handleText(ctx) {
  const state = getState(ctx.from.id);

  if (!state) {
    return false;
  }

  if (ctx.message?.text === "❌ لغو") {
    clearState(ctx.from.id);

    await ctx.reply(
      "❌ عملیات لغو شد.",
      mainMenu()
    );

    return true;
  }

  if (state.step === "searchUser") {
    await searchUser(
      ctx,
      ctx.message?.text
    );

    return true;
  }

  return false;
}

function createAdminUsersHandler(bot) {
  bot.hears(
    MENU,
    handleUserMenu
  );

  bot.hears(
    "🔎 جستجوی کاربر",
    handleSearchStart
  );

  bot.hears(
    "📊 آمار کاربران",
    async (ctx) => {
      if (!(await requirePermission(ctx))) {
        return;
      }

      await showUserStats(ctx);
    }
  );

  bot.hears(
    "🔙 مدیریت کاربران",
    handleBack
  );

  bot.on("text", async (ctx, next) => {
    const handled =
      await handleText(ctx);

    if (handled) {
      return;
    }

    return next();
  });
}

module.exports = {
  createAdminUsersHandler,
};
