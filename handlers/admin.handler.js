const {
  Markup,
} = require("telegraf");

const {
  getAdminByTelegramId,
  getPermissions,
} = require("../services/admin.service");

const {
  setSetting,
  getSetting,
} = require("../services/settings.service");

const {
  createAdminQuizHandler,
} = require("./admin-quiz.handler");

const {
  createAdminProHandler,
} = require("./admin-pro.handler");

const reportAdminStates = new Map();

function buildAdminMenu(admin) {
  const buttons = [
    ["🧠 مدیریت مسابقه"],
  ];

  if (
    admin?.role_key ===
    "super_admin"
  ) {
    buttons.push([
      "💎 مدیریت Pro",
    ]);

    buttons.push([
      "🐞 تنظیم ادمین گزارش",
    ]);
  }

  buttons.push([
    "🔙 خروج از پنل مدیریت",
  ]);

  return Markup.keyboard(
    buttons
  ).resize();
}

async function handleAdminCommand(ctx) {
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
        "⛔ شما دسترسی به پنل مدیریت ندارید."
      );

      return;
    }

    const permissions =
      await getPermissions(
        admin.user_id
      );

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
        `📋 دسترسی‌ها:\n${permissionText}\n\n` +
        `از منوی زیر بخش موردنظر را انتخاب کنید.`,
      buildAdminMenu(admin)
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

async function handleAdminExit(ctx) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  await ctx.reply(
    "🔙 از پنل مدیریت خارج شدید."
  );
}

async function handleQuizAdminMenu(ctx) {
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
        "⛔ شما دسترسی به پنل مدیریت ندارید."
      );

      return;
    }

    await ctx.reply(
      "🧠 مدیریت مسابقه\n\n" +
        "بخش موردنظر را انتخاب کنید.",
      Markup.keyboard([
        ["➕ افزودن سؤال"],
        ["🚨 گزارش‌های سؤالات"],
        ["🔙 پنل مدیریت"],
      ]).resize()
    );
  } catch (error) {
    console.error(
      "Quiz admin menu failed:",
      error
    );

    await ctx.reply(
      "❌ باز کردن مدیریت مسابقه انجام نشد."
    );
  }
}

async function handleBackToAdmin(ctx) {
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
      "⛔ شما دسترسی به پنل مدیریت ندارید."
    );

    return;
  }

  await ctx.reply(
    "🛠️ پنل مدیریت",
    buildAdminMenu(admin)
  );
}

async function handleProAdminMenu(ctx) {
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
        "⛔ شما دسترسی به پنل مدیریت ندارید."
      );

      return;
    }

    if (
      admin.role_key !==
      "super_admin"
    ) {
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
        ["🔙 پنل مدیریت"],
      ]).resize()
    );
  } catch (error) {
    console.error(
      "Pro admin menu failed:",
      error
    );

    await ctx.reply(
      "❌ باز کردن مدیریت Pro انجام نشد."
    );
  }
}

async function handleReportAdminMenu(ctx) {
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
        "⛔ شما دسترسی به پنل مدیریت ندارید."
      );

      return;
    }

    if (
      admin.role_key !==
      "super_admin"
    ) {
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

    const currentText =
      currentAdminId
        ? String(currentAdminId)
        : "تنظیم نشده";

    reportAdminStates.set(
      String(telegramUserId),
      {
        createdAt: Date.now(),
      }
    );

    await ctx.reply(
      "🐞 تنظیم ادمین گزارش\n\n" +
        `🆔 ادمین فعلی: ${currentText}\n\n` +
        "شناسه عددی تلگرام ادمینی که باید گزارش‌ها را دریافت کند ارسال کن.\n\n" +
        "مثال:\n" +
        "123456789\n\n" +
        "⏱️ تا 10 دقیقه فرصت داری."
    );
  } catch (error) {
    console.error(
      "Report admin menu failed:",
      error
    );

    await ctx.reply(
      "❌ تنظیم ادمین گزارش انجام نشد."
    );
  }
}

async function handleReportAdminText(ctx) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return false;
  }

  const state =
    reportAdminStates.get(
      String(telegramUserId)
    );

  if (!state) {
    return false;
  }

  reportAdminStates.delete(
    String(telegramUserId)
  );

  const admin =
    await getAdminByTelegramId(
      telegramUserId
    );

  if (
    !admin ||
    !admin.is_active ||
    admin.role_key !== "super_admin"
  ) {
    await ctx.reply(
      "⛔ فقط Super Admin می‌تواند ادمین گزارش را تنظیم کند."
    );

    return true;
  }

  if (
    Date.now() - state.createdAt >
    10 * 60 * 1000
  ) {
    await ctx.reply(
      "⏱️ زمان تنظیم ادمین گزارش تمام شده است.\nلطفاً دوباره وارد بخش تنظیم ادمین گزارش شو."
    );

    return true;
  }

  const reportAdminId =
    String(
      ctx.message?.text || ""
    ).trim();

  if (
    !/^\d+$/.test(reportAdminId)
  ) {
    await ctx.reply(
      "❌ شناسه نامعتبر است.\n\n" +
        "فقط ID عددی تلگرام را ارسال کن.\n\n" +
        "مثال:\n" +
        "123456789"
    );

    return true;
  }

  try {
    await setSetting(
      "support.report_admin_id",
      reportAdminId
    );

    await ctx.reply(
      "✅ ادمین گزارش با موفقیت تنظیم شد.\n\n" +
        `🆔 شناسه دریافت‌کننده: ${reportAdminId}\n\n` +
        "از این به بعد گزارش‌های دانلود برای این ادمین ارسال می‌شود.",
      buildAdminMenu(admin)
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

  return true;
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
    "💎 مدیریت Pro",
    handleProAdminMenu
  );

  bot.hears(
    "🐞 تنظیم ادمین گزارش",
    handleReportAdminMenu
  );

  bot.hears(
    "🔙 پنل مدیریت",
    handleBackToAdmin
  );

  bot.hears(
    "🔙 خروج از پنل مدیریت",
    handleAdminExit
  );

  bot.on(
    "text",
    async (ctx, next) => {
      const handled =
        await handleReportAdminText(
          ctx
        );

      if (handled) {
        return;
      }

      if (typeof next === "function") {
        return next();
      }
    }
  );

  createAdminQuizHandler(bot);

  createAdminProHandler(bot);
}

module.exports = {
  handleAdminCommand,
  createAdminHandler,
};
