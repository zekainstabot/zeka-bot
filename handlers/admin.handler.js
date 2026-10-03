const {
  Markup,
} = require("telegraf");

const {
  mainMenu,
} = require("../config/bot-menus");

const {
  getAdminByTelegramId,
} = require("../services/admin.service");

const {
  setUserCommands,
} = require("../services/command.service");

const {
  createAdminQuizHandler,
} = require("./admin-quiz.handler");

const {
  createAdminFortuneHandler,
} = require("./admin-fortune.handler");

async function handleAdminCommand(
  ctx
) {
  try {
    const telegramUserId =
      ctx.from?.id;

    if (!telegramUserId) {
      return;
    }

    const admin =
      await getAdminByTelegramId(
        telegramUserId
      );

    if (
      !admin ||
      !admin.is_active
    ) {
      await ctx.reply(
        "⛔ شما دسترسی به پنل ادمین ندارید."
      );

      return;
    }

    if (
      admin.role_key ===
      "super_admin"
    ) {
      await ctx.reply(
        "⛔ شما Super Admin هستید.\n\n" +
          "برای ورود از /superadmin استفاده کنید."
      );

      return;
    }

    await setUserCommands(
      ctx.telegram,
      telegramUserId,
      "admin"
    );

    await ctx.reply(
      "🛠️ پنل ادمین زکا\n\n" +
        `👤 Role: ${admin.role_name}\n\n` +
        "از منوی زیر بخش موردنظر را انتخاب کنید.",
      Markup.keyboard([
  ["🧠 مدیریت مسابقه"],
  ["🔮 مدیریت فال"],
  ["🔙 خروج از پنل مدیریت"],
]).resize()
  } catch (error) {
    console.error(
      "Admin command failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت پنل ادمین انجام نشد."
    );
  }
}

async function handleAdminExit(
  ctx,
  next
) {
  const admin =
    await getAdminByTelegramId(
      ctx.from?.id
    );

  if (
    admin &&
    admin.is_active &&
    admin.role_key ===
      "super_admin"
  ) {
    return next();
  }

  await setUserCommands(
    ctx.telegram,
    ctx.from.id,
    "user"
  );

  await ctx.reply(
    "🔙 از پنل مدیریت خارج شدید.",
    mainMenu
  );
}

async function handleQuizAdminMenu(
  ctx,
  next
) {
  const admin =
    await getAdminByTelegramId(
      ctx.from?.id
    );

  if (
    admin &&
    admin.is_active &&
    admin.role_key ===
      "super_admin"
  ) {
    return next();
  }

  if (
    !admin ||
    !admin.is_active
  ) {
    await ctx.reply(
      "⛔ این بخش فقط برای Admin است."
    );

    return;
  }

  await ctx.reply(
    "🧠 مدیریت مسابقه\n\n" +
      "بخش موردنظر را انتخاب کنید.",
    Markup.keyboard([
      ["➕ افزودن سؤال"],
      ["🚨 گزارش‌های سؤالات"],
      ["🔙 پنل ادمین"],
    ]).resize()
  );
}

async function handleBackToAdmin(
  ctx,
  next
) {
  const admin =
    await getAdminByTelegramId(
      ctx.from?.id
    );

  if (
    admin &&
    admin.is_active &&
    admin.role_key ===
      "super_admin"
  ) {
    return next();
  }

  if (
    !admin ||
    !admin.is_active
  ) {
    await ctx.reply(
      "⛔ این بخش فقط برای Admin است."
    );

    return;
  }

  await ctx.reply(
    "🛠️ پنل ادمین",
    Markup.keyboard([
      ["🧠 مدیریت مسابقه"],
      ["🔙 خروج از پنل مدیریت"],
    ]).resize()
  );
}

function createAdminHandler(
  bot
) {
  bot.command(
    "admin",
    handleAdminCommand
  );

  bot.hears(
    "🧠 مدیریت مسابقه",
    handleQuizAdminMenu
  );

  bot.hears(
    "🔙 پنل ادمین",
    handleBackToAdmin
  );

  bot.hears(
    "🔙 خروج از پنل مدیریت",
    handleAdminExit
  );

  createAdminQuizHandler(bot);
}

module.exports = {
  handleAdminCommand,
  createAdminHandler,
};
