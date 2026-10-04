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

async function handleAdminCommand(ctx) {
  console.log(
    "ADMIN COMMAND RECEIVED:",
    ctx.from?.id
  );

  try {
    const telegramUserId =
      ctx.from?.id;

    if (!telegramUserId) {
      console.error(
        "ADMIN COMMAND: Telegram user ID missing"
      );

      return;
    }

    console.log(
      "ADMIN COMMAND: checking admin access..."
    );

    const admin =
      await getAdminByTelegramId(
        telegramUserId
      );

    console.log(
      "ADMIN COMMAND: admin result:",
      admin
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

    await ctx.reply(
      "🛠️ پنل ادمین زکا\n\n" +
        `👤 Role: ${admin.role_name || admin.role_key}\n\n` +
        "از منوی زیر بخش موردنظر را انتخاب کنید.",
      Markup.keyboard([
        ["🧠 مدیریت مسابقه"],
        ["🔮 مدیریت فال"],
        ["🔙 خروج از پنل مدیریت"],
      ])
        .resize()
        .persistent()
    );

    try {
      await setUserCommands(
        ctx.telegram,
        telegramUserId,
        "admin"
      );
    } catch (commandError) {
      console.error(
        "ADMIN COMMAND: set commands failed:",
        commandError
      );
    }
  } catch (error) {
    console.error(
      "Admin command failed:",
      error
    );

    try {
      await ctx.reply(
        "❌ دریافت پنل ادمین انجام نشد."
      );
    } catch (replyError) {
      console.error(
        "Admin command error reply failed:",
        replyError
      );
    }
  }
}

async function handleAdminExit(
  ctx,
  next
) {
  try {
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

    try {
      await setUserCommands(
        ctx.telegram,
        ctx.from.id,
        "user"
      );
    } catch (commandError) {
      console.error(
        "Admin exit set commands failed:",
        commandError
      );
    }

    await ctx.reply(
      "🔙 از پنل مدیریت خارج شدید.",
      mainMenu
    );
  } catch (error) {
    console.error(
      "Admin exit failed:",
      error
    );
  }
}

async function handleQuizAdminMenu(
  ctx,
  next
) {
  try {
    const admin =
      await getAdminByTelegramId(
        ctx.from?.id
      );

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
      ])
        .resize()
        .persistent()
    );
  } catch (error) {
    console.error(
      "Admin quiz menu failed:",
      error
    );

    if (next) {
      return next();
    }
  }
}

async function handleBackToAdmin(
  ctx,
  next
) {
  try {
    const admin =
      await getAdminByTelegramId(
        ctx.from?.id
      );

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
        ["🔮 مدیریت فال"],
        ["🔙 خروج از پنل مدیریت"],
      ])
        .resize()
        .persistent()
    );
  } catch (error) {
    console.error(
      "Back to admin failed:",
      error
    );

    if (next) {
      return next();
    }
  }
}

function createAdminHandler(bot) {
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

  createAdminQuizHandler(
    bot
  );
}

module.exports = {
  handleAdminCommand,
  createAdminHandler,
};
