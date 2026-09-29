const {
  Markup,
} = require("telegraf");

const {
  getAdminByTelegramId,
  getPermissions,
} = require("../services/admin.service");

const {
  createAdminQuizHandler,
} = require("./admin-quiz.handler");

const {
  createAdminProHandler,
} = require("./admin-pro.handler");

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
    "🔙 پنل مدیریت",
    handleBackToAdmin
  );

  bot.hears(
    "🔙 خروج از پنل مدیریت",
    handleAdminExit
  );

  createAdminQuizHandler(bot);

  createAdminProHandler(bot);
}

module.exports = {
  handleAdminCommand,
  createAdminHandler,
};
