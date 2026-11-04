
const { Markup } = require("telegraf");

const adminService = require("../services/admin.service");
const userRepository = require("../repositories/user.repository");
const adminActionLogService = require("../services/admin-action-log.service");

const PAGE_SIZE = 10;
const states = new Map();

const ACTION_LABELS = {
  CREDIT_ADD: "➕ افزایش اعتبار",
  CREDIT_REMOVE: "➖ کاهش اعتبار",
  PRO_ENABLE: "🟢 فعال‌سازی Pro",
  PRO_DISABLE: "🔴 غیرفعال‌سازی Pro",
  USER_BLOCK: "🚫 مسدودسازی کاربر",
  USER_UNBLOCK: "🔓 آزادسازی کاربر",
};

const ACTION_BUTTONS = {
  "➕ افزایش اعتبار": "CREDIT_ADD",
  "➖ کاهش اعتبار": "CREDIT_REMOVE",
  "🟢 فعال‌سازی Pro": "PRO_ENABLE",
  "🔴 غیرفعال‌سازی Pro": "PRO_DISABLE",
  "🚫 مسدودسازی کاربر": "USER_BLOCK",
  "🔓 آزادسازی کاربر": "USER_UNBLOCK",
};

function setState(id, state) {
  states.set(String(id), state);
}

function getState(id) {
  return states.get(String(id)) || null;
}

function clearState(id) {
  states.delete(String(id));
}

function formatDate(value) {
  if (!value) {
    return "نامشخص";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "نامشخص";
  }

  return date.toLocaleString("fa-IR");
}

function formatDetails(details) {
  if (!details || typeof details !== "object") {
    return "جزئیاتی ثبت نشده";
  }

  const lines = [];

  if (details.amount !== undefined) {
    lines.push(`💳 مقدار: ${details.amount}`);
  }

  if (details.balance_before !== undefined) {
    lines.push(`📉 موجودی قبل: ${details.balance_before}`);
  }

  if (details.balance_after !== undefined) {
    lines.push(`📈 موجودی بعد: ${details.balance_after}`);
  }

  if (details.reason) {
    lines.push(`📝 دلیل: ${details.reason}`);
  }

  return lines.length
    ? lines.join("\n")
    : "جزئیاتی ثبت نشده";
}

function getFilterDescription(filters = {}) {
  const lines = [];

  if (filters.adminTelegramId) {
    lines.push(
      `👮 مدیر: ${filters.adminTelegramId}`
    );
  }

  if (filters.targetTelegramId) {
    lines.push(
      `👤 کاربر: ${filters.targetTelegramId}`
    );
  }

  if (filters.action) {
    lines.push(
      `⚙️ عملیات: ${
        ACTION_LABELS[filters.action] || filters.action
      }`
    );
  }

  return lines.length
    ? lines.join("\n")
    : "بدون فیلتر";
}

function historyMenu(page, totalPages, filters = {}) {
  const keyboard = [];

  const navigation = [];

  if (page > 0) {
    navigation.push("⬅️ صفحه قبل تاریخچه");
  }

  if (page < totalPages - 1) {
    navigation.push("➡️ صفحه بعد تاریخچه");
  }

  if (navigation.length) {
    keyboard.push(navigation);
  }

  keyboard.push(
    ["👮 فیلتر مدیر", "👤 فیلتر کاربر"],
    ["⚙️ فیلتر نوع عملیات"],
    ["🧹 پاک کردن فیلترها"],
    ["🔄 بروزرسانی تاریخچه"],
    ["🔙 منوی کاربران"]
  );

  return Markup.keyboard(keyboard).resize();
}

async function requireUsersPermission(ctx) {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    return null;
  }

  const admin =
    await adminService.getAdminByTelegramId(
      telegramId
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
      "users"
    );

  if (!allowed) {
    await ctx.reply(
      "⛔ دسترسی مدیریت کاربران را ندارید."
    );

    return null;
  }

  return admin;
}

async function showHistory(ctx, page = 0, filters = null) {
  const admin = await requireUsersPermission(ctx);

  if (!admin) {
    return;
  }

  const previousState = getState(ctx.from.id);

  const activeFilters =
    filters ||
    previousState?.filters ||
    {};

  try {
    const total =
      await adminActionLogService.getTotalCount({
        adminUserId: activeFilters.adminUserId,
        targetUserId: activeFilters.targetUserId,
        action: activeFilters.action,
      });

    if (total === 0) {
      setState(ctx.from.id, {
        step: "adminActionHistory",
        page: 0,
        totalPages: 0,
        filters: activeFilters,
      });

      await ctx.reply(
        "📚 تاریخچه اقدامات مدیران\n\n" +
        "هیچ سابقه‌ای با فیلترهای انتخاب‌شده پیدا نشد.\n\n" +
        `🔎 فیلترها:\n${getFilterDescription(activeFilters)}`,
        historyMenu(0, 0, activeFilters)
      );

      return;
    }

    const totalPages = Math.ceil(
      total / PAGE_SIZE
    );

    const safePage = Math.min(
      Math.max(Number(page) || 0, 0),
      totalPages - 1
    );

    const entries =
      await adminActionLogService.getHistory({
        adminUserId: activeFilters.adminUserId,
        targetUserId: activeFilters.targetUserId,
        action: activeFilters.action,
        limit: PAGE_SIZE,
        offset: safePage * PAGE_SIZE,
      });

    if (!entries.length) {
      await ctx.reply(
        "❌ سوابقی برای این صفحه پیدا نشد."
      );

      return;
    }

    const lines = entries.map((entry, index) => {
      const action =
        ACTION_LABELS[entry.action] ||
        entry.action;

      return (
        `${safePage * PAGE_SIZE + index + 1}. ${action}\n` +
        `👮 شناسه مدیر: ${entry.admin_telegram_user_id || "نامشخص"}\n` +
        `👤 شناسه کاربر: ${entry.target_telegram_user_id || "نامشخص"}\n` +
        `${formatDetails(entry.details)}\n` +
        `📅 تاریخ: ${formatDate(entry.created_at)}`
      );
    });

    setState(ctx.from.id, {
      step: "adminActionHistory",
      page: safePage,
      totalPages,
      filters: activeFilters,
    });

    await ctx.reply(
      "📚 تاریخچه اقدامات مدیران\n\n" +
      `📊 تعداد کل نتایج: ${total}\n` +
      `📄 صفحه ${safePage + 1} از ${totalPages}\n\n` +
      `🔎 فیلترها:\n${getFilterDescription(activeFilters)}\n\n` +
      "━━━━━━━━━━━━━━\n\n" +
      lines.join("\n\n"),
      historyMenu(
        safePage,
        totalPages,
        activeFilters
      )
    );
  } catch (error) {
    console.error(
      "Admin action history failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت تاریخچه اقدامات انجام نشد."
    );
  }
}

async function startAdminFilter(ctx) {
  const admin = await requireUsersPermission(ctx);

  if (!admin) {
    return;
  }

  setState(ctx.from.id, {
    step: "filterAdmin",
    filters: getState(ctx.from.id)?.filters || {},
  });

  await ctx.reply(
    "👮 فیلتر بر اساس مدیر\n\n" +
    "شناسه عددی تلگرام مدیر موردنظر را ارسال کن:",
    Markup.keyboard([
      ["❌ لغو فیلتر"],
    ]).resize()
  );
}

async function startUserFilter(ctx) {
  const admin = await requireUsersPermission(ctx);

  if (!admin) {
    return;
  }

  setState(ctx.from.id, {
    step: "filterUser",
    filters: getState(ctx.from.id)?.filters || {},
  });

  await ctx.reply(
    "👤 فیلتر بر اساس کاربر\n\n" +
    "شناسه عددی تلگرام کاربر موردنظر را ارسال کن:",
    Markup.keyboard([
      ["❌ لغو فیلتر"],
    ]).resize()
  );
}

async function startActionFilter(ctx) {
  const admin = await requireUsersPermission(ctx);

  if (!admin) {
    return;
  }

  setState(ctx.from.id, {
    step: "filterAction",
    filters: getState(ctx.from.id)?.filters || {},
  });

  await ctx.reply(
    "⚙️ نوع عملیات موردنظر را انتخاب کن:",
    Markup.keyboard([
      ["➕ افزایش اعتبار", "➖ کاهش اعتبار"],
      ["🟢 فعال‌سازی Pro", "🔴 غیرفعال‌سازی Pro"],
      ["🚫 مسدودسازی کاربر", "🔓 آزادسازی کاربر"],
      ["❌ لغو فیلتر"],
    ]).resize()
  );
}

async function applyAdminFilter(ctx, value, state) {
  const telegramId = String(value || "").trim();

  if (!/^\d+$/.test(telegramId)) {
    await ctx.reply(
      "❌ شناسه تلگرام معتبر نیست.\nفقط عدد ارسال کن."
    );

    return;
  }

  try {
    const targetAdmin =
      await adminService.getAdminByTelegramId(
        telegramId
      );

    if (!targetAdmin) {
      await ctx.reply(
        "❌ هیچ مدیری با این شناسه تلگرام پیدا نشد."
      );

      return;
    }

    const filters = {
      ...state.filters,
      adminUserId: targetAdmin.user_id,
      adminTelegramId: telegramId,
    };

    await showHistory(ctx, 0, filters);
  } catch (error) {
    console.error(
      "Admin history admin filter failed:",
      error
    );

    await ctx.reply(
      "❌ اعمال فیلتر مدیر انجام نشد."
    );
  }
}

async function applyUserFilter(ctx, value, state) {
  const telegramId = String(value || "").trim();

  if (!/^\d+$/.test(telegramId)) {
    await ctx.reply(
      "❌ شناسه تلگرام معتبر نیست.\nفقط عدد ارسال کن."
    );

    return;
  }

  try {
    const user =
      await userRepository.findByTelegramId(
        telegramId
      );

    if (!user) {
      await ctx.reply(
        "❌ کاربری با این شناسه تلگرام پیدا نشد."
      );

      return;
    }

    const filters = {
      ...state.filters,
      targetUserId: user.id,
      targetTelegramId: telegramId,
    };

    await showHistory(ctx, 0, filters);
  } catch (error) {
    console.error(
      "Admin history user filter failed:",
      error
    );

    await ctx.reply(
      "❌ اعمال فیلتر کاربر انجام نشد."
    );
  }
}

async function applyActionFilter(ctx, action, state) {
  if (!ACTION_LABELS[action]) {
    await ctx.reply(
      "❌ نوع عملیات معتبر نیست."
    );

    return;
  }

  const filters = {
    ...state.filters,
    action,
  };

  await showHistory(ctx, 0, filters);
}

async function clearFilters(ctx) {
  const admin = await requireUsersPermission(ctx);

  if (!admin) {
    return;
  }

  await showHistory(ctx, 0, {});
}

async function handleText(ctx, next) {
  const state = getState(ctx.from.id);

  if (!state) {
    return next();
  }

  const text = ctx.message?.text || "";

  if (text === "❌ لغو فیلتر") {
    await showHistory(
      ctx,
      0,
      state.filters || {}
    );

    return;
  }

  if (text === "🔙 منوی کاربران") {
    clearState(ctx.from.id);
    return next();
  }

  if (text === "👮 فیلتر مدیر") {
    return startAdminFilter(ctx);
  }

  if (text === "👤 فیلتر کاربر") {
    return startUserFilter(ctx);
  }

  if (text === "⚙️ فیلتر نوع عملیات") {
    return startActionFilter(ctx);
  }

  if (text === "🧹 پاک کردن فیلترها") {
    return clearFilters(ctx);
  }

  if (text === "🔄 بروزرسانی تاریخچه") {
    return showHistory(
      ctx,
      0,
      state.filters || {}
    );
  }

  if (text === "⬅️ صفحه قبل تاریخچه") {
    return showHistory(
      ctx,
      state.page - 1,
      state.filters || {}
    );
  }

  if (text === "➡️ صفحه بعد تاریخچه") {
    return showHistory(
      ctx,
      state.page + 1,
      state.filters || {}
    );
  }

  if (state.step === "filterAdmin") {
    return applyAdminFilter(
      ctx,
      text,
      state
    );
  }

  if (state.step === "filterUser") {
    return applyUserFilter(
      ctx,
      text,
      state
    );
  }

  if (state.step === "filterAction") {
    const action = ACTION_BUTTONS[text];

    if (!action) {
      await ctx.reply(
        "❌ یکی از عملیات‌های موجود در فهرست را انتخاب کن."
      );

      return;
    }

    return applyActionFilter(
      ctx,
      action,
      state
    );
  }

  return next();
}

function createAdminActionLogsHandler(bot) {
  bot.hears(
    "📚 تاریخچه اقدامات مدیران",
    (ctx) => showHistory(ctx, 0, {})
  );

  bot.hears(
    "👮 فیلتر مدیر",
    startAdminFilter
  );

  bot.hears(
    "👤 فیلتر کاربر",
    startUserFilter
  );

  bot.hears(
    "⚙️ فیلتر نوع عملیات",
    startActionFilter
  );

  bot.hears(
    "🧹 پاک کردن فیلترها",
    clearFilters
  );

  bot.hears(
    "🔄 بروزرسانی تاریخچه",
    (ctx) => {
      const state = getState(ctx.from.id);

      return showHistory(
        ctx,
        0,
        state?.filters || {}
      );
    }
  );

  bot.hears(
    "⬅️ صفحه قبل تاریخچه",
    (ctx) => {
      const state = getState(ctx.from.id);

      if (!state) {
        return showHistory(ctx, 0, {});
      }

      return showHistory(
        ctx,
        state.page - 1,
        state.filters || {}
      );
    }
  );

  bot.hears(
    "➡️ صفحه بعد تاریخچه",
    (ctx) => {
      const state = getState(ctx.from.id);

      if (!state) {
        return showHistory(ctx, 0, {});
      }

      return showHistory(
        ctx,
        state.page + 1,
        state.filters || {}
      );
    }
  );

  bot.on("text", handleText);
}

module.exports = {
  createAdminActionLogsHandler,
};
