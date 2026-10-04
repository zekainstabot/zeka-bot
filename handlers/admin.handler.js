const adminService = require("../services/admin.service");
const { createAdminManagementHandler } = require("./admin-management.handler");
const { createAdminQuizHandler } = require("./admin-quiz.handler");
const { createAdminProHandler } = require("./admin-pro.handler");
const { createAdminFortuneHandler } = require("./admin-fortune.handler");

const PERMISSION_BUTTONS = [
  {
    permission: "admins",
    button: "🛠 مدیریت ادمین",
  },
  {
    permission: "games.quiz",
    button: "🧠 مدیریت مسابقه",
  },
  {
    permission: "features.fortune.manage",
    button: "🔮 مدیریت فال",
  },
  {
    permission: "pro",
    button: "💎 مدیریت Pro",
  },
];

function buildAdminMenu(permissions) {
  const buttons = [];

  for (const item of PERMISSION_BUTTONS) {
    if (permissions[item.permission]) {
      buttons.push(item.button);
    }
  }

  buttons.push("🔙 خروج از پنل مدیریت");

  const rows = [];

  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  return rows;
}

async function getAdminPanelData(telegramUserId) {
  const admin = await adminService.getAdminByTelegramId(telegramUserId);

  if (!admin || !admin.is_active) {
    return null;
  }

  const permissions = {};

  for (const item of PERMISSION_BUTTONS) {
    try {
      permissions[item.permission] = await adminService.hasPermission(
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

  console.log("ADMIN PANEL PERMISSIONS:", {
    userId: admin.user_id,
    role: admin.role_key,
    permissions,
  });

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

  const data = await getAdminPanelData(telegramUserId);

  if (!data) {
    await ctx.reply("❌ شما دسترسی به پنل مدیریت ندارید.");
    return;
  }

  const { permissions } = data;

  const keyboard = buildAdminMenu(permissions);

  await ctx.reply("🛠 پنل مدیریت ادمین", {
    reply_markup: {
      keyboard,
      resize_keyboard: true,
    },
  });
}

async function handleAdminCommand(ctx) {
  await showAdminPanel(ctx);
}

async function handleBackToAdmin(ctx) {
  await showAdminPanel(ctx);
}

async function handleAdminExit(ctx) {
  await ctx.reply("از پنل مدیریت خارج شدید.");
}

function createAdminHandler(bot) {
  bot.command("admin", handleAdminCommand);

  bot.hears("🔙 پنل ادمین", handleBackToAdmin);

  bot.hears("🔙 خروج از پنل مدیریت", handleAdminExit);

  createAdminManagementHandler(bot);
  createAdminQuizHandler(bot);
  createAdminProHandler(bot);
  createAdminFortuneHandler(bot);
}

module.exports = {
  createAdminHandler,
  showAdminPanel,
  getAdminPanelData,
};
