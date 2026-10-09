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
  getSetting,
  setSetting,
} = require("../services/settings.service");

async function getSuperAdmin(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return null;
  }

  const admin = await getAdminByTelegramId(
    telegramUserId
  );

  if (
    !admin ||
    !admin.is_active ||
    admin.role_key !== "super_admin"
  ) {
    return null;
  }

  return admin;
}

function buildSuperAdminMenu() {
  return Markup.keyboard([
    [
      "👥 مدیریت کاربران",
      "⚙️ تنظیمات",
    ],
    [
      "📥 مدیریت درخواست‌ها",
      "💳 مدیریت اعتبار",
    ],
    [
      "🎁 مدیریت جوایز",
      "🌐 مدیریت پلتفرم‌ها",
    ],
    [
      "🍪 کوکی اینستاگرام",
    ],
    [
      "✨ مدیریت امکانات",
      "🆘 پشتیبانی",
    ],
    [
      "📊 مانیتورینگ",
      "🛠 مدیریت ادمین",
    ],
    [
      "📋 گزارش‌ها",
      "🐞 گزارش مشکلات",
    ],
    [
      "🧠 مدیریت مسابقه",
      "💎 مدیریت Pro",
    ],
    [
      "🔮 مدیریت فال",
    ],
    [
      "🔙 خروج از پنل Super Admin",
    ],
  ])
    .resize()
    .oneTime(false);
}

async function handleSuperAdminCommand(ctx) {
  try {
    const admin = await getSuperAdmin(ctx);

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
        "تمام امکانات مدیریتی از منوی زیر در دسترس است.",
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

async function handleSuperAdminQuizMenu(ctx) {
  const admin = await getSuperAdmin(ctx);

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
    ])
      .resize()
      .oneTime(false)
  );
}

async function handleProAdminMenu(ctx) {
  const admin = await getSuperAdmin(ctx);

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
    ])
      .resize()
      .oneTime(false)
  );
}

async function handlePlatformMenu(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ فقط Super Admin به مدیریت پلتفرم‌ها دسترسی دارد."
    );

    return;
  }

  try {
    const platforms = [
      {
        key: "platform.instagram",
        name: "اینستاگرام",
      },
      {
        key: "platform.tiktok",
        name: "تیک‌تاک",
      },
      {
        key: "platform.youtube",
        name: "یوتیوب",
      },
      {
        key: "platform.facebook",
        name: "فیسبوک",
      },
      {
        key: "platform.x",
        name: "X",
      },
      {
        key: "platform.pinterest",
        name: "پینترست",
      },
    ];

    const lines = [];

    for (const platform of platforms) {
      const enabled = await getSetting(
        platform.key,
        false
      );

      lines.push(
        `${enabled ? "🟢 فعال" : "🔴 غیرفعال"} — ${platform.name}`
      );
    }

    const tiktokEnabled = await getSetting(
      "platform.tiktok",
      false
    );

    const toggleButton = tiktokEnabled
      ? "🔴 غیرفعال کردن تیک‌تاک"
      : "🟢 فعال کردن تیک‌تاک";

    await ctx.reply(
      "🌐 مدیریت پلتفرم‌ها\n\n" +
        lines.join("\n") +
        "\n\nبرای تغییر وضعیت تیک‌تاک، دکمه زیر را بزنید.",
      Markup.keyboard([
        [toggleButton],
        ["🔄 تازه‌سازی وضعیت پلتفرم‌ها"],
        ["🔙 پنل Super Admin"],
      ])
        .resize()
        .oneTime(false)
    );
  } catch (error) {
    console.error(
      "Platform menu failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت وضعیت پلتفرم‌ها انجام نشد."
    );
  }
}

async function handleTikTokToggle(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ فقط Super Admin اجازه تغییر وضعیت تیک‌تاک را دارد."
    );

    return;
  }

  try {
    const currentValue = await getSetting(
      "platform.tiktok",
      false
    );

    const nextValue = !currentValue;

    await setSetting(
      "platform.tiktok",
      nextValue
    );

    await ctx.reply(
      nextValue
        ? "🟢 دانلود تیک‌تاک فعال شد."
        : "🔴 دانلود تیک‌تاک غیرفعال شد."
    );

    await handlePlatformMenu(ctx);
  } catch (error) {
    console.error(
      "TikTok setting update failed:",
      error
    );

    await ctx.reply(
      "❌ تغییر وضعیت تیک‌تاک انجام نشد. خطای ثبت تنظیمات را بررسی کنید."
    );
  }
}

async function handleBackToSuperAdmin(ctx) {
  const admin = await getSuperAdmin(ctx);

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

async function handleSuperAdminExit(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ فقط Super Admin می‌تواند از این پنل خارج شود."
    );

    return;
  }

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

function createSuperAdminHandler(bot) {
  bot.command(
    "superadmin",
    handleSuperAdminCommand
  );

  bot.hears(
    "🌐 مدیریت پلتفرم‌ها",
    handlePlatformMenu
  );

  bot.hears(
    "🟢 فعال کردن تیک‌تاک",
    handleTikTokToggle
  );

  bot.hears(
    "🔴 غیرفعال کردن تیک‌تاک",
    handleTikTokToggle
  );

  bot.hears(
    "🔄 تازه‌سازی وضعیت پلتفرم‌ها",
    handlePlatformMenu
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
    "🔙 پنل Super Admin",
    handleBackToSuperAdmin
  );

  bot.hears(
    "🔙 خروج از پنل Super Admin",
    handleSuperAdminExit
  );
}

module.exports = {
  handleSuperAdminCommand,
  createSuperAdminHandler,
};
