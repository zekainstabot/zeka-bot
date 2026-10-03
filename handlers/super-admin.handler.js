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
  setSetting,
  getSetting,
} = require("../services/settings.service");

const {
  createAdminProHandler,
} = require("./admin-pro.handler");

const {
  createAdminManagementHandler,
} = require("./admin-management.handler");

const {
  createAdminFortuneHandler,
} = require("./admin-fortune.handler");

const reportAdminStates =
  new Map();

async function getSuperAdmin(
  ctx
) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return null;
  }

  const admin =
    await getAdminByTelegramId(
      telegramUserId
    );

  if (
    !admin ||
    !admin.is_active ||
    admin.role_key !==
      "super_admin"
  ) {
    return null;
  }

  return admin;
}

function buildSuperAdminMenu() {
  return Markup.keyboard([
    ["🛠 مدیریت ادمین"],
    ["🧠 مدیریت مسابقه"],
    ["🔮 مدیریت فال"],
    ["💎 مدیریت Pro"],
    ["🐞 تنظیم ادمین گزارش"],
    ["🔙 خروج از پنل مدیریت"],
  ]).resize();
}

async function handleSuperAdminCommand(
  ctx
) {
  try {
    const admin =
      await getSuperAdmin(ctx);

    if (!admin) {
      await ctx.reply(
        "⛔ شما دسترسی به پنل Super Admin ندارید."
      );

      return;
    }

    await setUserCommands(
      ctx.telegram,
      ctx.from.id,
      "super_admin"
    );

    await ctx.reply(
      "👑 پنل Super Admin زکا\n\n" +
        "امکانات مدیریتی سطح بالا را از منوی زیر انتخاب کنید.",
      buildSuperAdminMenu()
    );
  } catch (error) {
    console.error(
      "Super Admin command failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت پنل Super Admin انجام نشد."
    );
  }
}

async function handleSuperAdminQuizMenu(
  ctx
) {
  const admin =
    await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ فقط Super Admin به این بخش دسترسی دارد."
    );

    return;
  }

  await ctx.reply(
    "🧠 مدیریت مسابقه\n\n" +
      "بخش موردنظر را انتخاب کنید.",
    Markup.keyboard([
      ["➕ افزودن سؤال"],
      ["🚨 گزارش‌های سؤالات"],
      ["🔙 پنل Super Admin"],
    ]).resize()
  );
}

async function handleProAdminMenu(
  ctx
) {
  const admin =
    await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ فقط Super Admin به مدیریت Pro دسترسی دارد."
    );

    return;
  }

  await ctx.reply(
    "💎 مدیریت Pro\n\n" +
      "عملیات موردنظر را انتخاب کنید.",
    Markup.keyboard([
      [
        "⭐ فعال‌سازی Pro",
        "⏳ تمدید Pro",
      ],
      [
        "🟢 روشن کردن Pro",
        "🔴 خاموش کردن Pro",
      ],
      ["❌ لغو Pro"],
      ["🔙 پنل Super Admin"],
    ]).resize()
  );
}

async function handleReportAdminMenu(
  ctx
) {
  const admin =
    await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ فقط Super Admin می‌تواند ادمین گزارش را تنظیم کند."
    );

    return;
  }

  const currentAdminId =
    await getSetting(
      "support.report_admin_id",
      ""
    );

  reportAdminStates.set(
    String(ctx.from.id),
    {
      createdAt: Date.now(),
    }
  );

  await ctx.reply(
    "🐞 تنظیم ادمین گزارش\n\n" +
      `🆔 ادمین فعلی: ${
        currentAdminId
          ? String(currentAdminId)
          : "تنظیم نشده"
      }\n\n` +
      "شناسه عددی تلگرام ادمینی که باید گزارش‌ها را دریافت کند ارسال کن.\n\n" +
      "مثال:\n" +
      "123456789\n\n" +
      "⏱️ تا 10 دقیقه فرصت داری."
  );
}

async function handleReportAdminText(
  ctx,
  next
) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return next();
  }

  const state =
    reportAdminStates.get(
      String(telegramUserId)
    );

  if (!state) {
    return next();
  }

  reportAdminStates.delete(
    String(telegramUserId)
  );

  const admin =
    await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ فقط Super Admin می‌تواند ادمین گزارش را تنظیم کند."
    );

    return;
  }

  if (
    Date.now() -
      state.createdAt >
    10 * 60 * 1000
  ) {
    await ctx.reply(
      "⏱️ زمان تنظیم ادمین گزارش تمام شده است."
    );

    return;
  }

  const reportAdminId =
    String(
      ctx.message?.text || ""
    ).trim();

  if (
    !/^\d+$/.test(
      reportAdminId
    )
  ) {
    await ctx.reply(
      "❌ فقط ID عددی تلگرام را ارسال کن.\n\n" +
        "مثال:\n" +
        "123456789"
    );

    return;
  }

  try {
    await setSetting(
      "support.report_admin_id",
      reportAdminId
    );

    await ctx.reply(
      "✅ ادمین گزارش با موفقیت تنظیم شد.\n\n" +
        `🆔 ${reportAdminId}`,
      buildSuperAdminMenu()
    );
  } catch (error) {
    console.error(
      "Failed to save report admin:",
      error
    );

    await ctx.reply(
      "❌ ذخیره ادمین گزارش انجام نشد."
    );
  }
}

async function handleBackToSuperAdmin(
  ctx
) {
  const admin =
    await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ فقط Super Admin به این بخش دسترسی دارد."
    );

    return;
  }

  await ctx.reply(
    "👑 پنل Super Admin",
    buildSuperAdminMenu()
  );
}

async function handleSuperAdminExit(
  ctx
) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  reportAdminStates.delete(
    String(telegramUserId)
  );

  await setUserCommands(
    ctx.telegram,
    telegramUserId,
    "user"
  );

  await ctx.reply(
    "🔙 از پنل Super Admin خارج شدید.",
    mainMenu
  );
}

function createSuperAdminHandler(
  bot
) {
  bot.command(
    "superadmin",
    handleSuperAdminCommand
  );

  bot.hears(
    "🧠 مدیریت مسابقه",
    handleSuperAdminQuizMenu
  );

  bot.hears(
    "💎 مدیریت Pro",
    handleProAdminMenu
  );

  bot.hears(
    "🐞 تنظیم ادمین گزارش",
    handleReportAdminMenu
  );

  bot.hears(
    "🔙 پنل Super Admin",
    handleBackToSuperAdmin
  );

  bot.hears(
    "🔙 خروج از پنل مدیریت",
    handleSuperAdminExit
  );

  bot.on(
    "text",
    handleReportAdminText
  );

  createAdminManagementHandler(
    bot
  );

  createAdminFortuneHandler(
    bot
  );

  createAdminProHandler(
    bot
  );
}

module.exports = {
  handleSuperAdminCommand,
  createSuperAdminHandler,
};
