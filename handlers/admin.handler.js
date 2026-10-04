const {
  Markup,
} = require("telegraf");

const {
  mainMenu,
} = require("../config/bot-menus");

const adminService =
  require("../services/admin.service");

const {
  getAdminByTelegramId,
} = adminService;

const {
  setUserCommands,
} = require("../services/command.service");

const {
  createAdminQuizHandler,
} = require("./admin-quiz.handler");

const {
  createAdminManagementHandler,
} = require("./admin-management.handler");

const PERMISSION_KEYS = [
  "users",
  "settings",
  "requests",
  "credits",
  "rewards",
  "platforms",
  "features",
  "support",
  "monitoring",
  "admins",
  "reports",
  "bug_reports",
  "games.quiz",
  "pro",
  "features.fortune.manage",
];

const PERMISSION_BUTTONS = {
  users: "👥 کاربران",
  settings: "⚙️ تنظیمات",
  requests: "📥 درخواست‌ها",
  credits: "💳 اعتبارها",
  rewards: "🎁 پاداش‌ها",
  platforms: "🌐 پلتفرم‌ها",
  features: "✨ قابلیت‌ها",
  support: "🆘 پشتیبانی",
  monitoring: "📊 مانیتورینگ",
  admins: "🛠 مدیریت ادمین",
  reports: "📋 گزارش‌ها",
  bug_reports: "🐛 گزارش مشکل",
  "games.quiz": "🧠 مدیریت مسابقه",
  pro: "💎 مدیریت Pro",
  "features.fortune.manage": "🔮 مدیریت فال",
};

async function getAdminPanelData(
  telegramUserId
) {
  const admin =
    await getAdminByTelegramId(
      telegramUserId
    );

  if (
    !admin ||
    !admin.is_active
  ) {
    return null;
  }

  const permissions = {};

  for (
    const permissionKey of PERMISSION_KEYS
  ) {
    permissions[permissionKey] =
      await adminService.hasPermission(
        admin.user_id,
        permissionKey
      );
  }

  return {
    admin,
    permissions,
  };
}

function buildAdminMainMenu(
  permissions
) {
  const buttons = [];

  const permissionOrder = [
    "users",
    "settings",
    "requests",
    "credits",
    "rewards",
    "platforms",
    "features",
    "support",
    "monitoring",
    "admins",
    "reports",
    "bug_reports",
    "games.quiz",
    "pro",
    "features.fortune.manage",
  ];

  for (
    const permissionKey of permissionOrder
  ) {
    if (
      permissions[permissionKey] &&
      PERMISSION_BUTTONS[permissionKey]
    ) {
      buttons.push([
        PERMISSION_BUTTONS[
          permissionKey
        ],
      ]);
    }
  }

  buttons.push([
    "🔙 خروج از پنل مدیریت",
  ]);

  return Markup.keyboard(
    buttons
  )
    .resize()
    .persistent();
}

async function showAdminMainMenu(
  ctx
) {
  const data =
    await getAdminPanelData(
      ctx.from?.id
    );

  if (!data) {
    await ctx.reply(
      "⛔ شما دسترسی به پنل ادمین ندارید."
    );

    return;
  }

  await ctx.reply(
    "🛠️ پنل ادمین زکا\n\n" +
      `👤 Role: ${
        data.admin.role_name ||
        data.admin.role_key
      }\n\n` +
      "از منوی زیر بخش موردنظر را انتخاب کنید.",
    buildAdminMainMenu(
      data.permissions
    )
  );
}

async function handleAdminCommand(
  ctx
) {
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

    const data =
      await getAdminPanelData(
        telegramUserId
      );

    console.log(
      "ADMIN COMMAND: admin result:",
      data?.admin
    );

    if (!data) {
      await ctx.reply(
        "⛔ شما دسترسی به پنل ادمین ندارید."
      );

      return;
    }

    await showAdminMainMenu(
      ctx
    );

    try {
      await setUserCommands(
        ctx.telegram,
        telegramUserId,
        "admin"
      );
    } catch (
      commandError
    ) {
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
    } catch (
      replyError
    ) {
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
    } catch (
      commandError
    ) {
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
    const data =
      await getAdminPanelData(
        ctx.from?.id
      );

    if (
      !data ||
      !data.permissions[
        "games.quiz"
      ]
    ) {
      await ctx.reply(
        "⛔ شما دسترسی مدیریت مسابقه را ندارید."
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

async function handleAdminManagementMenu(
  ctx
) {
  try {
    const data =
      await getAdminPanelData(
        ctx.from?.id
      );

    if (
      !data ||
      !data.permissions.admins
    ) {
      await ctx.reply(
        "⛔ شما دسترسی مدیریت ادمین را ندارید."
      );

      return;
    }

    await adminManagementHandler(
      ctx
    );
  } catch (error) {
    console.error(
      "Admin management menu failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت مدیریت ادمین انجام نشد."
    );
  }
}

async function handleBackToAdmin(
  ctx,
  next
) {
  try {
    const data =
      await getAdminPanelData(
        ctx.from?.id
      );

    if (!data) {
      await ctx.reply(
        "⛔ این بخش فقط برای Admin است."
      );

      return;
    }

    await showAdminMainMenu(
      ctx
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

async function handleFortuneAdminMenu(
  ctx
) {
  try {
    const data =
      await getAdminPanelData(
        ctx.from?.id
      );

    if (
      !data ||
      !data.permissions[
        "features.fortune.manage"
      ]
    ) {
      await ctx.reply(
        "⛔ شما دسترسی مدیریت فال را ندارید."
      );

      return;
    }

    await ctx.reply(
      "🔮 مدیریت فال\n\n" +
        "برای ورود به مدیریت فال از گزینه‌های موجود استفاده کنید."
    );

    await ctx.reply(
      "🔮 مدیریت فال",
      Markup.keyboard([
        ["➕ افزودن فال دستی"],
        ["📥 ورود فال از سایت"],
        [
          "📚 بانک فال‌ها",
          "📊 آمار فال‌ها",
        ],
        ["🔙 پنل ادمین"],
      ])
        .resize()
        .persistent()
    );
  } catch (error) {
    console.error(
      "Admin fortune menu failed:",
      error
    );
  }
}

let adminManagementHandler = null;

async function initializeAdminManagementHandler(
  bot
) {
  if (
    adminManagementHandler
  ) {
    return;
  }

  const module =
    require(
      "./admin-management.handler"
    );

  if (
    typeof module.handleAdminManagementMenu ===
    "function"
  ) {
    adminManagementHandler =
      module.handleAdminManagementMenu;
  }
}

function createAdminHandler(
  bot
) {
  initializeAdminManagementHandler(
    bot
  ).catch((error) => {
    console.error(
      "Admin management handler initialization failed:",
      error
    );
  });

  bot.command(
    "admin",
    handleAdminCommand
  );

  bot.hears(
    "🛠 مدیریت ادمین",
    handleAdminManagementMenu
  );

  bot.hears(
    "🧠 مدیریت مسابقه",
    handleQuizAdminMenu
  );

  bot.hears(
    "🔮 مدیریت فال",
    handleFortuneAdminMenu
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

  createAdminManagementHandler(
    bot
  );
}

module.exports = {
  handleAdminCommand,
  createAdminHandler,
  showAdminMainMenu,
};
