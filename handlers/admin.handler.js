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

const {
  createAdminProHandler,
} = require("./admin-pro.handler");

const {
  createAdminFortuneHandler,
} = require("./admin-fortune.handler");

const PERMISSION_KEYS = [
  "admins",
  "games.quiz",
  "features.fortune.manage",
  "pro",
];

const PERMISSION_BUTTONS = {
  admins: "🛠 مدیریت ادمین",
  "games.quiz": "🧠 مدیریت مسابقه",
  "features.fortune.manage":
    "🔮 مدیریت فال",
  pro: "💎 مدیریت Pro",
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

  for (
    const permissionKey of PERMISSION_KEYS
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
  try {
    const telegramUserId =
      ctx.from?.id;

    if (!telegramUserId) {
      return;
    }

    const data =
      await getAdminPanelData(
        telegramUserId
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
    } catch (error) {
      console.error(
        "ADMIN COMMAND: set commands failed:",
        error
      );
    }
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
    } catch (error) {
      console.error(
        "Admin exit set commands failed:",
        error
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

function createAdminHandler(
  bot
) {
  bot.command(
    "admin",
    handleAdminCommand
  );

  bot.hears(
    "🔙 پنل ادمین",
    handleBackToAdmin
  );

  bot.hears(
    "🔙 خروج از پنل مدیریت",
    handleAdminExit
  );

  createAdminManagementHandler(
    bot
  );

  createAdminQuizHandler(
    bot
  );

  createAdminProHandler(
    bot
  );

  createAdminFortuneHandler(
    bot
  );
}

module.exports = {
  handleAdminCommand,
  createAdminHandler,
  showAdminMainMenu,
};
