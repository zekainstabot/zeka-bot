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

const PLATFORMS = [
  { key: "platform.instagram", name: "اینستاگرام" },
  { key: "platform.tiktok", name: "تیک‌تاک" },
  { key: "platform.youtube", name: "یوتیوب" },
  { key: "platform.facebook", name: "فیسبوک" },
  { key: "platform.x", name: "X" },
  { key: "platform.pinterest", name: "پینترست" },
];

async function getSuperAdmin(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return null;
  }

  const admin = await getAdminByTelegramId(telegramUserId);

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
    ["👥 مدیریت کاربران", "⚙️ تنظیمات"],
    ["📥 مدیریت درخواست‌ها", "💳 مدیریت اعتبار"],
    ["🎁 مدیریت جوایز", "🌐 مدیریت پلتفرم‌ها"],
    ["🍪 کوکی اینستاگرام"],
    ["✨ مدیریت امکانات", "🆘 پشتیبانی"],
    ["📊 مانیتورینگ", "🛠 مدیریت ادمین"],
    ["📋 گزارش‌ها", "🐞 گزارش مشکلات"],
    ["🧠 مدیریت مسابقه", "💎 مدیریت Pro"],
    ["🔮 مدیریت فال"],
    ["🔙 خروج از پنل Super Admin"],
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
    console.error("Super Admin command failed:", error);

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
    "🧠 مدیریت مسابقه\n\nبخش موردنظر را انتخاب کنید.",
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
    "💎 مدیریت Pro\n\nعملیات موردنظر را انتخاب کنید.",
    Markup.keyboard([
      ["⭐ فعال‌سازی Pro", "⏳ تمدید Pro"],
      ["🟢 روشن کردن Pro", "🔴 خاموش کردن Pro"],
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
    const lines = [];
    const buttons = [];

    for (const platform of PLATFORMS) {
      const enabled = await getSetting(
        platform.key,
        false
      );

      lines.push(
        `${enabled ? "🟢 فعال" : "🔴 غیرفعال"} — ${platform.name}`
      );

      buttons.push([
        `${enabled ? "🔴 خاموش کردن" : "🟢 روشن کردن"} ${platform.name}`,
      ]);
    }

    buttons.push(
      ["🔄 تازه‌سازی وضعیت پلتفرم‌ها"],
      ["🔙 پنل Super Admin"]
    );

    await ctx.reply(
      "🌐 مدیریت پلتفرم‌ها\n\n" +
        lines.join("\n") +
        "\n\nبرای تغییر وضعیت هر پلتفرم، دکمه مربوط به آن را بزن.",
      Markup.keyboard(buttons)
        .resize()
        .oneTime(false)
    );
  } catch (error) {
    console.error("Platform menu failed:", error);

    await ctx.reply(
      "❌ دریافت وضعیت پلتفرم‌ها انجام نشد."
    );
  }
}

async function handlePlatformToggle(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ فقط Super Admin اجازه تغییر وضعیت پلتفرم‌ها را دارد."
    );
    return;
  }

  const text = ctx.message?.text || "";

  const platform = PLATFORMS.find((item) =>
    text.endsWith(item.name) &&
    (
      text.startsWith("🟢 روشن کردن") ||
      text.startsWith("🔴 خاموش کردن")
    )
  );

  if (!platform) {
    return;
  }

  try {
    const currentValue = await getSetting(
      platform.key,
      false
    );

    const requestedValue = text.startsWith(
      "🟢 روشن کردن"
    );

    if (Boolean(currentValue) === requestedValue) {
      await ctx.reply(
        requestedValue
          ? "🟢 این پلتفرم از قبل فعال است."
          : "🔴 این پلتفرم از قبل غیرفعال است."
      );

      await handlePlatformMenu(ctx);
      return;
    }

    await setSetting(
      platform.key,
      requestedValue
    );

    await ctx.reply(
      `${requestedValue ? "🟢 فعال شد" : "🔴 غیرفعال شد"}: ${platform.name}`
    );

    await handlePlatformMenu(ctx);
  } catch (error) {
    console.error("Platform setting update failed:", error);

    await ctx.reply(
      `❌ تغییر وضعیت ${platform.name} انجام نشد. خطای ثبت تنظیمات را بررسی کنید.`
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
    /^(🟢 روشن کردن|🔴 خاموش کردن) (اینستاگرام|تیک‌تاک|یوتیوب|فیسبوک|X|پینترست)$/,
    handlePlatformToggle
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
