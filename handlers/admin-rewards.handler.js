const { Markup } = require("telegraf");

const adminService = require("../services/admin.service");
const settingsService = require("../services/settings.service");
const giftCodeRepository = require("../repositories/gift-code.repository");

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

function mainMenu(admin) {
  const isSuperAdmin =
    admin?.role_key === "super_admin";

  return Markup.keyboard([
    ["👥 Referral", "🎯 مأموریت‌ها"],
    ["🎰 شانس"],
    ["🔄 بروزرسانی وضعیت"],
    [
      isSuperAdmin
        ? "🔙 سرگرمی"
        : "🔙 پنل ادمین",
    ],
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
  const admin = await requirePermission(ctx);

  if (!admin) {
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
      "برای تغییر وضعیت، بخش موردنظر را انتخاب کنید.\n\nساخت کد هدیه:\n/giftcode CODE CREDIT XP PRO_DAYS MAX_USES\nنمونه: /giftcode ZEKA100 100 50 0 100\nبرای استفاده نامحدود، MAX_USES را 0 بگذار.",
    mainMenu(admin)
  );
}

async function toggleFeature(
  ctx,
  featureKey,
  title
) {
  const admin = await requirePermission(ctx);

  if (!admin) {
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
      mainMenu(admin)
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


async function handleCreateGiftCode(ctx) {
  const admin = await requirePermission(ctx);
  if (!admin) return;

  const parts = String(ctx.message?.text || "").trim().split(/\\s+/);
  if (parts.length !== 6) {
    await ctx.reply(
      "فرمت دستور:\n/giftcode CODE CREDIT XP PRO_DAYS MAX_USES\nنمونه: /giftcode ZEKA100 100 50 0 100"
    );
    return;
  }

  const [, rawCode, rawCredit, rawXp, rawProDays, rawMaxUses] = parts;
  const code = String(rawCode).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const creditAmount = Number(rawCredit);
  const xpAmount = Number(rawXp);
  const proDays = Number(rawProDays);
  const maxUsesValue = Number(rawMaxUses);

  if (
    code.length < 3 || code.length > 50 ||
    !Number.isFinite(creditAmount) || creditAmount < 0 ||
    !Number.isInteger(xpAmount) || xpAmount < 0 ||
    !Number.isInteger(proDays) || proDays < 0 ||
    !Number.isInteger(maxUsesValue) || maxUsesValue < 0 ||
    (creditAmount === 0 && xpAmount === 0 && proDays === 0)
  ) {
    await ctx.reply("مقادیر کد هدیه معتبر نیستند. حداقل یکی از اعتبار، XP یا روز پرو باید بیشتر از صفر باشد.");
    return;
  }

  try {
    const gift = await giftCodeRepository.create({
      code,
      description: "هدیه ساخته‌شده توسط مدیریت",
      creditAmount,
      xpAmount,
      proDays,
      maxUses: maxUsesValue === 0 ? null : maxUsesValue,
      perUserLimit: 1,
      createdBy: admin.user_id,
      status: "ACTIVE"
    });

    await ctx.reply(
      "✅ کد هدیه ساخته شد.\n\n" +
      `🎟 کد: ${gift.code}\n` +
      `💳 اعتبار: ${creditAmount}\n` +
      `✨ XP: ${xpAmount}\n` +
      `⭐ روز پرو: ${proDays}\n` +
      `👥 سقف استفاده: ${maxUsesValue === 0 ? "نامحدود" : maxUsesValue}`
    );
  } catch (error) {
    console.error("Admin gift code creation failed:", error);
    const duplicate = error.code === "23505";
    await ctx.reply(duplicate ? "❌ این کد قبلاً ساخته شده است." : "❌ ساخت کد هدیه انجام نشد.");
  }
}

function createAdminRewardsHandler(bot) {
  bot.command("giftcode", handleCreateGiftCode);

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
