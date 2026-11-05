const { Markup } = require("telegraf");

const adminService = require("../services/admin.service");
const userRepository = require("../repositories/user.repository");
const creditService = require("../services/admin-user-credit.service");
const adminActionLogService = require("../services/admin-action-log.service");

const flows = new Map();

const FINANCE_NAVIGATION_BUTTONS = [
  "💰 مالی",
  "💳 تراکنش‌ها",
  "💳 مدیریت اعتبار",
  "💎 مدیریت Pro",
  "⭐ درآمد Pro",
  "🔄 تازه‌سازی درآمد Pro",
  "🏷️ تخفیف عمومی Pro",
  "📊 مشاهده قیمت پلن‌ها",
  "💰 تغییر قیمت پلن‌ها",
  "✏️ تغییر تخفیف عمومی",
  "🎟️ کدهای تخفیف",
  "➕ ساخت کد تخفیف",
  "📋 مشاهده کدهای تخفیف",
  "🔄 تازه‌سازی کدها",
  "🔙 مدیریت کدهای تخفیف",
  "🔙 مشاهده کدهای تخفیف",
  "💰 درآمدها",
  "💸 هزینه‌ها",
  "📊 گزارش مالی",
  "🔎 کاربر دیگر",
  "➕ افزایش اعتبار مالی",
  "➖ کاهش اعتبار مالی",
  "📜 تاریخچه اعتبار مالی",
  "🔙 بخش مالی",
  "🔙 پنل Super Admin",
  "🔙 خروج از پنل Super Admin",
  "🔄 تازه‌سازی وضعیت پلتفرم‌ها",
];

async function getSuperAdmin(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return null;
  }

  const admin = await adminService.getAdminByTelegramId(
    telegramUserId
  );

  if (
    !admin ||
    !admin.is_active ||
    admin.role_key !== "super_admin"
  ) {
    await ctx.reply(
      "⛔ فقط Super Admin به این بخش دسترسی دارد."
    );

    return null;
  }

  return admin;
}

function formatAmount(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return "نامشخص";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "نامشخص";
  }

  return date.toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
  });
}

function creditProfileMenu() {
  return Markup.keyboard([
    ["➕ افزایش اعتبار مالی", "➖ کاهش اعتبار مالی"],
    ["📜 تاریخچه اعتبار مالی"],
    ["🔎 کاربر دیگر"],
    ["🔙 بخش مالی"],
  ])
    .resize()
    .oneTime(false);
}

function creditCancelMenu() {
  return Markup.keyboard([
    ["❌ لغو عملیات"],
    ["🔙 بخش مالی"],
  ])
    .resize()
    .oneTime(false);
}

async function showCreditProfile(ctx, user) {
  const balance = await creditService.getBalance(user.id);

  flows.set(String(ctx.from.id), {
    step: "profile",
    userId: user.id,
    telegramUserId: user.telegram_user_id,
  });

  const username = user.username
    ? `@${user.username}`
    : "ثبت نشده";

  await ctx.reply(
    "💳 مدیریت اعتبار کاربر\n\n" +
      `👤 نام: ${user.display_name || "بدون نام"}\n` +
      `🔹 Username: ${username}\n` +
      `🆔 Telegram ID: ${user.telegram_user_id}\n` +
      `🆔 شناسه داخلی: ${user.id}\n\n` +
      `💰 موجودی قابل استفاده: ${formatAmount(balance)} اعتبار\n\n` +
      "عملیات موردنظر را انتخاب کن.",
    creditProfileMenu()
  );
}

async function handleCreditMenu(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    return;
  }

  flows.set(String(ctx.from.id), {
    step: "search",
  });

  await ctx.reply(
    "💳 مدیریت اعتبار کاربران\n\n" +
      "Telegram ID کاربر موردنظر را ارسال کن.",
    creditCancelMenu()
  );
}

async function handleCreditSearchStart(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    return;
  }

  flows.set(String(ctx.from.id), {
    step: "search",
  });

  await ctx.reply(
    "🔎 Telegram ID کاربر جدید را ارسال کن.",
    creditCancelMenu()
  );
}

async function handleCreditOperationStart(ctx, operation) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    return;
  }

  const state = flows.get(String(ctx.from.id));

  if (!state || state.step !== "profile") {
    await ctx.reply("ابتدا کاربر را جستجو کن.");
    return;
  }

  flows.set(String(ctx.from.id), {
    ...state,
    step: "amount",
    operation,
  });

  const title = operation === "add"
    ? "➕ افزایش اعتبار"
    : "➖ کاهش اعتبار";

  await ctx.reply(
    `${title}\n\n` +
      `👤 Telegram ID: ${state.telegramUserId}\n\n` +
      "مقدار اعتبار را به عدد وارد کن.\n" +
      "حداکثر مقدار مجاز: ۱٬۰۰۰٬۰۰۰",
    creditCancelMenu()
  );
}

async function handleCreditHistory(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    return;
  }

  const state = flows.get(String(ctx.from.id));

  if (!state || state.step !== "profile") {
    await ctx.reply("ابتدا کاربر را جستجو کن.");
    return;
  }

  try {
    const history = await creditService.getHistory(
      state.userId,
      15
    );

    if (!history.length) {
      await ctx.reply(
        "📜 تاریخچه اعتبار\n\n" +
          "برای این کاربر هنوز تراکنش اعتباری ثبت نشده است.",
        creditProfileMenu()
      );

      return;
    }

    const lines = history.map((item, index) => {
      const amount = Number(item.amount || 0);
      const sign = amount > 0 ? "+" : "";

      return (
        `${index + 1}. ${item.entry_type}\n` +
        `💳 مقدار: ${sign}${formatAmount(amount)}\n` +
        `📉 قبل: ${formatAmount(item.balance_before)}\n` +
        `📈 بعد: ${formatAmount(item.balance_after)}\n` +
        `📝 توضیح: ${item.description || "ثبت نشده"}\n` +
        `📅 زمان: ${formatDate(item.created_at)}`
      );
    });

    await ctx.reply(
      "📜 آخرین تراکنش‌های اعتبار\n\n" +
        `👤 Telegram ID: ${state.telegramUserId}\n\n` +
        lines.join("\n\n━━━━━━━━━━━━━━\n\n"),
      creditProfileMenu()
    );
  } catch (error) {
    console.error(
      "Finance credit history failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت تاریخچه اعتبار انجام نشد.",
      creditProfileMenu()
    );
  }
}

async function logCreditAction({
  admin,
  ctx,
  state,
  result,
}) {
  try {
    await adminActionLogService.recordAction({
      adminUserId: admin.user_id,
      adminTelegramUserId: ctx.from.id,
      targetUserId: state.userId,
      targetTelegramUserId: state.telegramUserId,
      action: state.operation === "add"
        ? "CREDIT_ADD"
        : "CREDIT_REMOVE",
      details: {
        amount: result.amount,
        balance_before: result.balanceBefore,
        balance_after: result.balanceAfter,
        source: "SUPER_ADMIN_FINANCE",
      },
    });
  } catch (error) {
    console.error(
      "Finance credit action log failed:",
      error
    );
  }
}

async function processCreditAmount(ctx, text, state, admin) {
  const normalized = String(text)
    .replace(/,/g, ".")
    .trim();

  const amount = Number(normalized);

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1000000
  ) {
    await ctx.reply(
      "❌ مقدار نامعتبر است.\n\n" +
        "مقدار باید بیشتر از صفر و حداکثر ۱٬۰۰۰٬۰۰۰ باشد."
    );

    return;
  }

  try {
    let result;

    if (state.operation === "add") {
      result = await creditService.addCredit({
        userId: state.userId,
        amount,
        adminTelegramId: ctx.from.id,
      });
    } else {
      result = await creditService.removeCredit({
        userId: state.userId,
        amount,
        adminTelegramId: ctx.from.id,
      });
    }

    await logCreditAction({
      admin,
      ctx,
      state,
      result,
    });

    const user = await userRepository.findById(
      state.userId
    );

    if (!user) {
      flows.delete(String(ctx.from.id));

      await ctx.reply(
        "✅ عملیات انجام شد، اما اطلاعات کاربر برای نمایش مجدد پیدا نشد."
      );

      return;
    }

    await ctx.reply(
      (state.operation === "add"
        ? "✅ اعتبار با موفقیت افزایش یافت."
        : "✅ اعتبار با موفقیت کاهش یافت.") +
        "\n\n" +
        `👤 Telegram ID: ${state.telegramUserId}\n` +
        `💳 مقدار تغییر: ${formatAmount(result.amount)}\n` +
        `📉 موجودی قبل: ${formatAmount(result.balanceBefore)}\n` +
        `📈 موجودی بعد: ${formatAmount(result.balanceAfter)}`
    );

    await showCreditProfile(ctx, user);
  } catch (error) {
    console.error(
      "Finance credit adjustment failed:",
      error
    );

    let message = "❌ تغییر اعتبار انجام نشد.";

    if (error.message === "INSUFFICIENT_CREDIT") {
      message = "❌ موجودی کاربر برای کاهش این مقدار کافی نیست.";
    } else if (error.message === "INVALID_AMOUNT") {
      message = "❌ مقدار اعتبار نامعتبر است.";
    } else if (error.message === "AMOUNT_TOO_LARGE") {
      message = "❌ مقدار واردشده بیش از حد مجاز است.";
    }

    flows.set(String(ctx.from.id), {
      step: "profile",
      userId: state.userId,
      telegramUserId: state.telegramUserId,
    });

    await ctx.reply(message, creditProfileMenu());
  }
}

async function handleCreditText(ctx, next) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return next();
  }

  const key = String(telegramUserId);
  const state = flows.get(key);

  if (!state) {
    return next();
  }

  const text = String(
    ctx.message?.text || ""
  ).trim();

  // اجازه عبور فرمان‌ها و پاک‌سازی جریان قبلی
  if (text.startsWith("/")) {
    flows.delete(key);
    return next();
  }

  // خروج از بخش اعتبار
  if (
    text === "🔙 بخش مالی" ||
    text === "🔙 پنل Super Admin" ||
    text === "🔙 خروج از پنل Super Admin"
  ) {
    flows.delete(key);
    return next();
  }

  // لغو عملیات جاری
  if (text === "❌ لغو عملیات") {
    if (state.userId) {
      const user = await userRepository.findById(
        state.userId
      );

      if (user) {
        await showCreditProfile(ctx, user);
        return;
      }
    }

    flows.delete(key);

    await ctx.reply(
      "عملیات لغو شد.",
      Markup.keyboard([
        ["💳 مدیریت اعتبار"],
        ["🔙 بخش مالی"],
      ]).resize()
    );

    return;
  }

  // عبور از دکمه‌های منوهای دیگر و حذف جریان قدیمی
  if (
    FINANCE_NAVIGATION_BUTTONS.includes(text) ||
    /^🔴 غیرفعال‌کردن کد \d+$/.test(text) ||
    /^🟢 فعال‌کردن کد \d+$/.test(text) ||
    /^👥 کاربران کد \d+$/.test(text)
  ) {
    flows.delete(key);
    return next();
  }

  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    flows.delete(key);
    return;
  }

  // جستجوی کاربر
  if (state.step === "search") {
    if (!/^\d+$/.test(text)) {
      await ctx.reply(
        "❌ Telegram ID باید فقط شامل عدد باشد."
      );

      return;
    }

    try {
      const user = await userRepository.findByTelegramId(
        text
      );

      if (!user) {
        await ctx.reply(
          "❌ کاربری با این Telegram ID پیدا نشد.\n\n" +
            "یک شناسه دیگر ارسال کن."
        );

        return;
      }

      await showCreditProfile(ctx, user);
    } catch (error) {
      console.error(
        "Finance credit user search failed:",
        error
      );

      await ctx.reply(
        "❌ جستجوی کاربر انجام نشد."
      );
    }

    return;
  }

  // دریافت مقدار افزایش یا کاهش اعتبار
  if (state.step === "amount") {
    await processCreditAmount(
      ctx,
      text,
      state,
      admin
    );

    return;
  }

  return next();
}

function createSuperAdminFinanceCreditHandler(bot) {
  // ابتدا middleware متنی ثبت می‌شود.
  bot.on("text", handleCreditText);

  bot.hears(
    "💳 مدیریت اعتبار",
    handleCreditMenu
  );

  bot.hears(
    "🔎 کاربر دیگر",
    handleCreditSearchStart
  );

  bot.hears(
    "➕ افزایش اعتبار مالی",
    (ctx) => handleCreditOperationStart(ctx, "add")
  );

  bot.hears(
    "➖ کاهش اعتبار مالی",
    (ctx) => handleCreditOperationStart(ctx, "remove")
  );

  bot.hears(
    "📜 تاریخچه اعتبار مالی",
    handleCreditHistory
  );
}

module.exports = {
  createSuperAdminFinanceCreditHandler,
};
