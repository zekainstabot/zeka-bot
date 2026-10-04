const { Markup } = require("telegraf");

const adminService = require("../services/admin.service");
const settingsService = require("../services/settings.service");

const MENU = "🎁 مدیریت جوایز";

const FEATURES = [
  {
    key: "feature.referral",
    title: "👥 Referral",
  },
  {
    key: "feature.missions",
    title: "🎯 مأموریت‌ها",
  },
  {
    key: "feature.luck",
    title: "🎰 شانس",
  },
];

function mainMenu() {
  return Markup.keyboard([
    ["👥 Referral", "🎯 مأموریت‌ها"],
    ["🎰 شانس"],
    ["🔄 بروزرسانی وضعیت"],
    ["🔙 پنل ادمین"],
  ]).resize();
}

async function requirePermission(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return null;
  }

  const admin =
    await adminService.getAdminByTelegramId(
      telegramUserId
    );

  if (!admin || !admin.is_active) {
    await ctx.reply(
      "⛔ حساب مدیریتی شما فعال نیست."
    );

    return null;
  }

  const allowed =
    await adminService.hasPermission(
      admin.user_id,
      "rewards"
    );

  if (!allowed) {
    await ctx.reply(
      "⛔ شما دسترسی مدیریت جوایز را ندارید."
    );

    return null;
  }

  return admin;
}

async function getFeatureStatus() {
  const result = {};

  for (const feature of FEATURES) {
    result[feature.key] =
      await settingsService.isFeatureEnabled(
        feature.key.replace(
          "feature.",
          ""
        )
      );
  }

  return result;
}

function statusIcon(enabled) {
  return enabled ? "🟢" : "🔴";
}

async function showRewardsPanel(ctx) {
  if (!(await requirePermission(ctx))) {
    return;
  }

  const status =
    await getFeatureStatus();

  const referral =
    status["feature.referral"];

  const missions =
    status["feature.missions"];

  const luck =
    status["feature.luck"];

  await ctx.reply(
    "🎁 مدیریت جوایز\n\n" +
      `${statusIcon(referral)} Referral: ${
        referral ? "فعال" : "غیرفعال"
      }\n` +
      `${statusIcon(missions)} مأموریت‌ها: ${
        missions ? "فعال" : "غیرفعال"
      }\n` +
      `${statusIcon(luck)} شانس: ${
        luck ? "فعال" : "غیرفعال"
      }\n\n` +
      "برای تغییر وضعیت، بخش موردنظر را انتخاب کنید.",
    mainMenu()
  );
}

async function toggleFeature(
  ctx,
  featureKey,
  title
) {
  if (!(await requirePermission(ctx))) {
    return;
  }

  try {
    const current =
      await settingsService.getSetting(
        featureKey,
        false
      );

    const next = !current;

    await settingsService.setSetting(
      featureKey,
      next
    );

    await ctx.reply(
      `${next ? "🟢" : "🔴"} ${title}\n\n` +
        `وضعیت جدید: ${
          next ? "فعال" : "غیرفعال"
        }`,
      mainMenu()
    );
  } catch (error) {
    console.error(
      "Admin reward feature toggle failed:",
      error
    );

    await ctx.reply(
      "❌ تغییر وضعیت انجام نشد."
    );
  }
}

async function handleReferral(ctx) {
  await toggleFeature(
    ctx,
    "feature.referral",
    "👥 Referral"
  );
}

async function handleMissions(ctx) {
  await toggleFeature(
    ctx,
    "feature.missions",
    "🎯 مأموریت‌ها"
  );
}

async function handleLuck(ctx) {
  await toggleFeature(
    ctx,
    "feature.luck",
    "🎰 شانس"
  );
}

async function handleRefresh(ctx) {
  await showRewardsPanel(ctx);
}

function createAdminRewardsHandler(bot) {
  bot.hears(
    MENU,
    showRewardsPanel
  );

  bot.hears(
    "👥 Referral",
    handleReferral
  );

  bot.hears(
    "🎯 مأموریت‌ها",
    handleMissions
  );

  bot.hears(
    "🎰 شانس",
    handleLuck
  );

  bot.hears(
    "🔄 بروزرسانی وضعیت",
    handleRefresh
  );
}

module.exports = {
  createAdminRewardsHandler,
  showRewardsPanel,
};
