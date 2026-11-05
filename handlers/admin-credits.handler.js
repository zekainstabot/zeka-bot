const { Markup } = require("telegraf");

const adminService = require("../services/admin.service");
const userRepository = require("../repositories/user.repository");
const creditService = require("../services/credit.service");
const adminCreditService = require("../services/admin-credit.service");
const adminActionLogService = require("../services/admin-action-log.service");

const states = new Map();

const MENU = "💳 مدیریت اعتبار";

function setState(userId, state) {
  states.set(String(userId), state);
}

function getState(userId) {
  return states.get(String(userId)) || null;
}

function clearState(userId) {
  states.delete(String(userId));
}

function mainMenu() {
  return Markup.keyboard([
    ["➕ افزودن اعتبار", "➖ کم کردن اعتبار"],
    ["🔎 موجودی کاربر"],
    ["🔙 پنل ادمین"],
  ]).resize();
}

function inputMenu() {
  return Markup.keyboard([
    ["❌ لغو"],
    ["🔙 مدیریت اعتبار"],
  ]).resize();
}

async function requirePermission(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return null;
  }

  const admin = await adminService.getAdminByTelegramId(
    telegramUserId
  );

  if (!admin || !admin.is_active) {
    await ctx.reply(
      "⛔ حساب مدیریتی شما فعال نیست."
    );
    return null;
  }

  // Super Admin از پنل مالی اختصاصی خودش استفاده می‌کند.
  if (admin.role_key === "super_admin") {
    return admin;
  }

  const allowed = await adminService.hasPermission(
    admin.user_id,
    "credits"
  );

  if (!allowed) {
    await ctx.reply(
      "⛔ شما دسترسی مدیریت اعتبار را ندارید."
    );
    return null;
  }

  return admin;
}

async function logAdminAction(data) {
  try {
    await adminActionLogService.recordAction(data);
  } catch (error) {
    console.error(
      "Admin action log failed:",
      error
    );
  }
}

async function findUser(value) {
  const query = String(value || "").trim();

  if (!query) {
    return null;
  }

  if (/^\d+$/.test(query)) {
    let user = await userRepository.findByTelegramId(
      query
    );

    if (!user) {
      user = await userRepository.findById(
        Number(query)
      );
    }

    return user;
  }

  return null;
}

async function showBalance(ctx, user) {
  if (!user) {
    await ctx.reply(
      "❌ کاربر پیدا نشد.",
      mainMenu()
    );
    return;
  }

  const balance = await creditService.getBalance(
    user.id
  );

  const username = user.username
    ? `@${user.username}`
    : "ثبت نشده";

  await ctx.reply(
    "💳 موجودی کاربر\n\n" +
      `👤 ${user.display_name || "بدون نام"}\n` +
      `🔹 Username: ${username}\n` +
      `🆔 Telegram ID: ${user.telegram_user_id}\n` +
      `💳 اعتبار: ${balance}`,
    mainMenu()
  );
}

async function startAdd(ctx) {
  if (!(await requirePermission(ctx))) {
    return;
  }

  setState(ctx.from.id, {
    step: "add_user",
  });

  await ctx.reply(
    "➕ افزودن اعتبار\n\n" +
      "Telegram ID یا شناسه داخلی کاربر را ارسال کنید.",
    inputMenu()
  );
}

async function startRemove(ctx) {
  if (!(await requirePermission(ctx))) {
    return;
  }

  setState(ctx.from.id, {
    step: "remove_user",
  });

  await ctx.reply(
    "➖ کم کردن اعتبار\n\n" +
      "Telegram ID یا شناسه داخلی کاربر را ارسال کنید.",
    inputMenu()
  );
}

async function startBalance(ctx) {
  if (!(await requirePermission(ctx))) {
    return;
  }

  setState(ctx.from.id, {
    step: "balance_user",
  });

  await ctx.reply(
    "🔎 موجودی کاربر\n\n" +
      "Telegram ID یا شناسه داخلی کاربر را ارسال کنید.",
    inputMenu()
  );
}

async function processUser(ctx, value) {
  const state = getState(ctx.from.id);

  if (!state) {
    return false;
  }

  if (
    state.step === "add_user" ||
    state.step === "remove_user" ||
    state.step === "balance_user"
  ) {
    const user = await findUser(value);

    if (!user) {
      await ctx.reply(
        "❌ کاربر پیدا نشد.\n\nTelegram ID یا شناسه داخلی معتبر ارسال کنید."
      );
      return true;
    }

    if (state.step === "balance_user") {
      clearState(ctx.from.id);
      await showBalance(ctx, user);
      return true;
    }

    setState(ctx.from.id, {
      step:
        state.step === "add_user"
          ? "add_amount"
          : "remove_amount",
      userId: user.id,
      telegramUserId: user.telegram_user_id,
    });

    await ctx.reply(
      "💳 مقدار اعتبار را ارسال کنید.\n\nمثال: 5 یا 2.5",
      inputMenu()
    );

    return true;
  }

  if (
    state.step === "add_amount" ||
    state.step === "remove_amount"
  ) {
    const amount = Number(
      String(value)
        .trim()
        .replace(",", ".")
    );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      await ctx.reply(
        "❌ مقدار اعتبار نامعتبر است."
      );
      return true;
    }

    // بررسی مجدد دسترسی مدیر پیش از انجام عملیات
    const admin = await requirePermission(ctx);

    if (!admin) {
      clearState(ctx.from.id);
      return true;
    }

    try {
      if (state.step === "add_amount") {
        const result = await adminCreditService.addCredits({
          userId: state.userId,
          amount,
        });

        await logAdminAction({
          adminUserId: admin.user_id,
          adminTelegramUserId: ctx.from.id,
          targetUserId: state.userId,
          targetTelegramUserId: state.telegramUserId,
          action: "CREDIT_ADD",
          details: {
            amount,
            balanceBefore: result.balanceBefore,
            balanceAfter: result.balanceAfter,
            source: "admin_credits_panel",
          },
        });

        clearState(ctx.from.id);

        await ctx.reply(
          "✅ اعتبار با موفقیت اضافه شد.\n\n" +
            `👤 Telegram ID: ${state.telegramUserId}\n` +
            `➕ مقدار: ${amount}\n` +
            `💳 موجودی قبلی: ${result.balanceBefore}\n` +
            `💳 موجودی جدید: ${result.balanceAfter}`,
          mainMenu()
        );

        return true;
      }

      const result = await adminCreditService.removeCredits({
        userId: state.userId,
        amount,
      });

      await logAdminAction({
        adminUserId: admin.user_id,
        adminTelegramUserId: ctx.from.id,
        targetUserId: state.userId,
        targetTelegramUserId: state.telegramUserId,
        action: "CREDIT_REMOVE",
        details: {
          amount,
          balanceBefore: result.balanceBefore,
          balanceAfter: result.balanceAfter,
          source: "admin_credits_panel",
        },
      });

      clearState(ctx.from.id);

      await ctx.reply(
        "✅ اعتبار با موفقیت کم شد.\n\n" +
          `👤 Telegram ID: ${state.telegramUserId}\n` +
          `➖ مقدار: ${amount}\n` +
          `💳 موجودی قبلی: ${result.balanceBefore}\n` +
          `💳 موجودی جدید: ${result.balanceAfter}`,
        mainMenu()
      );

      return true;
    } catch (error) {
      console.error(
        "Admin credit operation failed:",
        error
      );

      if (
        String(error.message).includes(
          "Insufficient credit"
        )
      ) {
        await ctx.reply(
          "❌ موجودی کاربر برای این مقدار کافی نیست."
        );
        return true;
      }

      await ctx.reply(
        "❌ عملیات اعتبار انجام نشد."
      );

      return true;
    }
  }

  return false;
}

async function handleText(ctx, next) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return next();
  }

  const state = getState(telegramUserId);

  if (!state) {
    return next();
  }

  const text = ctx.message?.text?.trim();

  if (!text) {
    return next();
  }

  // دستورات بات نباید به‌عنوان شناسه یا مبلغ پردازش شوند.
  if (text.startsWith("/")) {
    clearState(telegramUserId);
    return next();
  }

  // دکمه‌های خروج و جابه‌جایی بین منوها
  const navigationButtons = [
    "🔙 پنل Super Admin",
    "🔙 خروج از پنل Super Admin",
    "🔙 پنل ادمین",
    "💰 مالی",
    "💎 مدیریت Pro",
    "⭐ درآمد Pro",
    "🏷️ تخفیف عمومی Pro",
    "📊 مشاهده قیمت پلن‌ها",
    "💰 تغییر قیمت پلن‌ها",
    "✏️ تغییر تخفیف عمومی",
    "🎟️ کدهای تخفیف",
    "➕ ساخت کد تخفیف",
    "📋 مشاهده کدهای تخفیف",
    "🔙 بخش مالی",
  ];

  if (navigationButtons.includes(text)) {
    clearState(telegramUserId);
    return next();
  }

  if (text === "❌ لغو") {
    clearState(telegramUserId);

    await ctx.reply(
      "❌ عملیات لغو شد.",
      mainMenu()
    );

    return;
  }

  if (text === "🔙 مدیریت اعتبار") {
    clearState(telegramUserId);

    await ctx.reply(
      "💳 مدیریت اعتبار",
      mainMenu()
    );

    return;
  }

  const handled = await processUser(
    ctx,
    text
  );

  if (handled) {
    return;
  }

  return next();
}

async function handleMenu(ctx, next) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return next();
  }

  const admin = await adminService.getAdminByTelegramId(
    telegramUserId
  );

  if (!admin || !admin.is_active) {
    await ctx.reply(
      "⛔ حساب مدیریتی شما فعال نیست."
    );
    return;
  }

  // دکمه مشترک است؛ Super Admin باید وارد پنل مالی شود.
  if (admin.role_key === "super_admin") {
    return next();
  }

  const allowed = await adminService.hasPermission(
    admin.user_id,
    "credits"
  );

  if (!allowed) {
    await ctx.reply(
      "⛔ شما دسترسی مدیریت اعتبار را ندارید."
    );
    return;
  }

  clearState(ctx.from.id);

  await ctx.reply(
    "💳 مدیریت اعتبار\n\n" +
      "عملیات موردنظر را انتخاب کنید.",
    mainMenu()
  );
}

function createAdminCreditsHandler(bot) {
  bot.hears(
    MENU,
    handleMenu
  );

  bot.hears(
    "➕ افزودن اعتبار",
    startAdd
  );

  bot.hears(
    "➖ کم کردن اعتبار",
    startRemove
  );

  bot.hears(
    "🔎 موجودی کاربر",
    startBalance
  );

  bot.on(
    "text",
    handleText
  );
}

module.exports = {
  createAdminCreditsHandler,
};
