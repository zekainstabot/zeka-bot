
const adminService = require("../services/admin.service");

const {
  quizAdminMenu,
} = require("./admin-quiz/menu");

const {
  createAdminManagementHandler,
} = require("./admin-management.handler");

const {
  createAdminQuizHandler,
} = require("./admin-quiz.handler");

const {
  createAdminRequestsHandler,
} = require("./admin-requests.handler");

const {
  createAdminSupportHandler,
} = require("./admin-support.handler");

const {
  createAdminProHandler,
} = require("./admin-pro.handler");

const {
  createAdminFortuneHandler,
} = require("./admin-fortune.handler");

const {
  createAdminUsersHandler,
} = require("./admin-users.handler");

const {
  createAdminBlockedUsersHandler,
} = require("./admin-blocked-users.handler");

const {
  createAdminActionLogsHandler,
} = require("./admin-action-logs.handler");

const {
  createAdminCreditsHandler,
} = require("./admin-credits.handler");

const {
  createAdminRewardsHandler,
} = require("./admin-rewards.handler");

const {
  createAdminMonitoringHandler,
} = require("./admin-monitoring.handler");

const {
  createAdminBugReportsHandler,
} = require("./admin-bug-reports.handler");

const {
  createAdminReportsHandler,
} = require("./admin-reports.handler");

const {
  createZekaMediaHandler,
} = require("./zeka-media.handler");

const ENTERTAINMENT_BUTTON = "🎮 سرگرمی";
const SUPPORT_BUTTON = "🆘 پشتیبانی";

const ENTERTAINMENT_SECTIONS = [
  {
    permission: "games.quiz",
    button: "🧠 مدیریت مسابقه",
  },
  {
    permission: "features.fortune.manage",
    button: "🔮 مدیریت فال",
  },
  {
    permission: "rewards",
    button: "🎁 مدیریت جوایز",
  },
];

const SUPPORT_SECTIONS = [
  {
    permission: "reports",
    button: "📋 گزارش‌ها",
  },
  {
    permission: "bug_reports",
    button: "🐞 گزارش مشکلات",
  },
  {
    permission: "support",
    button: "💬 مدیریت پشتیبانی",
  },
  {
    permission: "requests",
    button: "📥 مدیریت درخواست‌ها",
  },
];

const PERMISSION_BUTTONS = [
  {
    permission: "zeka_media",
    button: "📺 مدیریت زکا مدیا",
  },
  {
    permission: "users",
    button: "👥 مدیریت کاربران",
  },
  {
    permission: "settings",
    button: "⚙️ تنظیمات",
  },
  {
    permission: "credits",
    button: "💳 مدیریت اعتبار",
  },
  {
    permission: "platforms",
    button: "🌐 مدیریت پلتفرم‌ها",
  },
  {
    permission: "features",
    button: "✨ مدیریت امکانات",
  },
  {
    permission: "monitoring",
    button: "📊 مانیتورینگ",
  },
  {
    permission: "admins",
    button: "🛠 مدیریت ادمین",
  },
  {
    permission: "pro",
    button: "💎 مدیریت Pro",
  },
  ...ENTERTAINMENT_SECTIONS,
];

const UNIMPLEMENTED_BUTTONS = [
  "✨ مدیریت امکانات",
];

const ALL_PERMISSION_SECTIONS = [
  ...PERMISSION_BUTTONS,
  ...SUPPORT_SECTIONS,
];

const BUTTON_PERMISSIONS = new Map(
  ALL_PERMISSION_SECTIONS.map((item) => [
    item.button,
    item.permission,
  ])
);

function buildAdminMenu(permissions) {
  const buttons = [];

  for (const item of PERMISSION_BUTTONS) {
    const isEntertainmentSection =
      ENTERTAINMENT_SECTIONS.some(
        (section) =>
          section.permission === item.permission
      );

    if (isEntertainmentSection) {
      continue;
    }

    if (permissions[item.permission]) {
      buttons.push(item.button);
    }
  }

  const hasEntertainmentPermission =
    ENTERTAINMENT_SECTIONS.some(
      (section) =>
        permissions[section.permission]
    );

  if (hasEntertainmentPermission) {
    buttons.push(ENTERTAINMENT_BUTTON);
  }

  const hasSupportPermission =
    SUPPORT_SECTIONS.some(
      (section) =>
        permissions[section.permission]
    );

  if (hasSupportPermission) {
    buttons.push(SUPPORT_BUTTON);
  }

  buttons.push("🔙 خروج از پنل مدیریت");

  const rows = [];

  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  return rows;
}

async function getAdminPanelData(telegramUserId) {
  const admin =
    await adminService.getAdminByTelegramId(
      telegramUserId
    );

  if (!admin || !admin.is_active) {
    return null;
  }

  const permissions = {};

  for (const item of ALL_PERMISSION_SECTIONS) {
    if (permissions[item.permission] !== undefined) {
      continue;
    }

    try {
      permissions[item.permission] =
        await adminService.hasPermission(
          admin.user_id,
          item.permission
        );
    } catch (error) {
      console.error(
        `ADMIN PERMISSION ERROR [${item.permission}]:`,
        error
      );

      permissions[item.permission] = false;
    }
  }

  return {
    admin,
    permissions,
  };
}

async function showAdminPanel(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  try {
    const data =
      await getAdminPanelData(telegramUserId);

    if (!data) {
      await ctx.reply(
        "❌ شما دسترسی به پنل مدیریت ندارید."
      );

      return;
    }

    await ctx.reply(
      "🛠 پنل مدیریت ادمین",
      {
        reply_markup: {
          keyboard: buildAdminMenu(
            data.permissions
          ),
          resize_keyboard: true,
          one_time_keyboard: false,
        },
      }
    );
  } catch (error) {
    console.error(
      "Show admin panel failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت پنل مدیریت انجام نشد."
    );
  }
}

async function showEntertainmentMenu(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  try {
    const admin =
      await adminService.getAdminByTelegramId(
        telegramUserId
      );

    if (!admin || !admin.is_active) {
      await ctx.reply(
        "⛔ دسترسی به پنل مدیریت ندارید."
      );

      return;
    }

    if (admin.role_key === "super_admin") {
      await ctx.reply(
        "🎮 مدیریت سرگرمی\n\nبخش موردنظر را انتخاب کنید.",
        {
          reply_markup: {
            keyboard: [
              ["🧠 مدیریت مسابقه"],
              ["🔮 مدیریت فال"],
              ["🎁 مدیریت جوایز"],
              ["🔙 پنل Super Admin"],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
          },
        }
      );

      return;
    }

    const buttons = [];

    for (const section of ENTERTAINMENT_SECTIONS) {
      const allowed =
        await adminService.hasPermission(
          admin.user_id,
          section.permission
        );

      if (allowed) {
        buttons.push([section.button]);
      }
    }

    if (buttons.length === 0) {
      await ctx.reply(
        "⛔ شما به بخش‌های سرگرمی دسترسی ندارید."
      );

      return;
    }

    buttons.push(["🔙 پنل ادمین"]);

    await ctx.reply(
      "🎮 سرگرمی\n\nبخش موردنظر را انتخاب کنید:",
      {
        reply_markup: {
          keyboard: buttons,
          resize_keyboard: true,
          one_time_keyboard: false,
        },
      }
    );
  } catch (error) {
    console.error(
      "Entertainment menu failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت منوی سرگرمی انجام نشد."
    );
  }
}

async function showSupportMenu(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  try {
    const admin =
      await adminService.getAdminByTelegramId(
        telegramUserId
      );

    if (!admin || !admin.is_active) {
      await ctx.reply(
        "⛔ دسترسی به پنل مدیریت ندارید."
      );

      return;
    }

    const buttons = [];

    if (admin.role_key === "super_admin") {
      buttons.push(
        ["📋 گزارش‌ها"],
        ["🐞 گزارش مشکلات"],
        ["💬 مدیریت پشتیبانی"],
        ["📥 مدیریت درخواست‌ها"]
      );
    } else {
      for (const section of SUPPORT_SECTIONS) {
        const allowed =
          await adminService.hasPermission(
            admin.user_id,
            section.permission
          );

        if (allowed) {
          buttons.push([section.button]);
        }
      }
    }

    if (buttons.length === 0) {
      await ctx.reply(
        "⛔ شما به بخش‌های پشتیبانی دسترسی ندارید."
      );

      return;
    }

    const backButton =
      admin.role_key === "super_admin"
        ? "🔙 پنل Super Admin"
        : "🔙 پنل ادمین";

    buttons.push([backButton]);

    await ctx.reply(
      "🆘 پشتیبانی\n\nبخش موردنظر را انتخاب کنید:",
      {
        reply_markup: {
          keyboard: buttons,
          resize_keyboard: true,
          one_time_keyboard: false,
        },
      }
    );
  } catch (error) {
    console.error(
      "Support menu failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت منوی پشتیبانی انجام نشد."
    );
  }
}

async function showAdminQuizMenu(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  try {
    const admin =
      await adminService.getAdminByTelegramId(
        telegramUserId
      );

    if (!admin || !admin.is_active) {
      await ctx.reply(
        "⛔ دسترسی مدیریت ندارید."
      );

      return;
    }

    const allowed =
      await adminService.hasPermission(
        admin.user_id,
        "games.quiz"
      );

    if (!allowed) {
      await ctx.reply(
        "⛔ دسترسی مدیریت مسابقه ندارید."
      );

      return;
    }

    await ctx.reply(
      "🧠 مدیریت مسابقه\n\nبخش موردنظر را انتخاب کنید.",
      await quizAdminMenu(ctx)
    );
  } catch (error) {
    console.error(
      "Admin quiz menu failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت منوی مسابقه انجام نشد."
    );
  }
}

async function handleAdminCommand(ctx) {
  await showAdminPanel(ctx);
}

async function handleBackToAdmin(ctx) {
  await showAdminPanel(ctx);
}

async function handleAdminExit(ctx) {
  await ctx.reply(
    "از پنل مدیریت خارج شدید."
  );
}

async function handleUnavailableAdminSection(ctx) {
  const button = ctx.message?.text;

  const permission =
    BUTTON_PERMISSIONS.get(button);

  if (!button || !permission) {
    return;
  }

  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  try {
    const admin =
      await adminService.getAdminByTelegramId(
        telegramUserId
      );

    if (!admin || !admin.is_active) {
      await ctx.reply(
        "⛔ دسترسی به پنل مدیریت ندارید."
      );

      return;
    }

    const allowed =
      await adminService.hasPermission(
        admin.user_id,
        permission
      );

    if (!allowed) {
      await ctx.reply(
        "⛔ شما به این بخش دسترسی ندارید."
      );

      return;
    }

    await ctx.reply(
      `⏳ بخش «${button}» هنوز Handler عملیاتی ندارد.\n\n` +
        "Permission این بخش فعال است، اما منطق مدیریتی آن باید در Handler اختصاصی خودش پیاده‌سازی شود."
    );
  } catch (error) {
    console.error(
      "Admin section router failed:",
      error
    );

    await ctx.reply(
      "❌ اجرای بخش مدیریت انجام نشد."
    );
  }
}

function createAdminHandler(bot) {
  bot.command(
    "admin",
    handleAdminCommand
  );

  bot.hears(
    "🔙 پنل ادمین",
    handleBackToAdmin
  );

  bot.hears(
    ENTERTAINMENT_BUTTON,
    showEntertainmentMenu
  );

  bot.hears(
    SUPPORT_BUTTON,
    showSupportMenu
  );

  bot.hears(
    "🧠 مدیریت مسابقه",
    showAdminQuizMenu
  );

  bot.hears(
    "🔙 خروج از پنل مدیریت",
    handleAdminExit
  );

  createAdminManagementHandler(bot);
  createAdminQuizHandler(bot);
  createAdminProHandler(bot);
  createAdminFortuneHandler(bot);

  createAdminUsersHandler(bot);
  createAdminBlockedUsersHandler(bot);
  createAdminActionLogsHandler(bot);

  createAdminCreditsHandler(bot);
  createAdminRewardsHandler(bot);
  createAdminRequestsHandler(bot);
  createAdminMonitoringHandler(bot);
  createAdminBugReportsHandler(bot);
  createAdminReportsHandler(bot);
  createAdminSupportHandler(bot);

  createZekaMediaHandler(bot);

  for (const button of UNIMPLEMENTED_BUTTONS) {
    bot.hears(
      button,
      handleUnavailableAdminSection
    );
  }
}

module.exports = {
  createAdminHandler,
  showAdminPanel,
  showEntertainmentMenu,
  showSupportMenu,
  showAdminQuizMenu,
  getAdminPanelData,
  buildAdminMenu,
  PERMISSION_BUTTONS,
  SUPPORT_SECTIONS,
};
