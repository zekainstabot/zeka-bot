
const { Markup } = require("telegraf");
const adminService = require("../services/admin.service");
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
  if (!value) return "نامشخص";

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

function historyMenu(page, totalPages) {
  const navigation = [];

  if (page > 0) {
    navigation.push("⬅️ صفحه قبل تاریخچه");
  }

  if (page < totalPages - 1) {
    navigation.push("➡️ صفحه بعد تاریخچه");
  }

  const keyboard = [];

  if (navigation.length) {
    keyboard.push(navigation);
  }

  keyboard.push(
    ["🔄 بروزرسانی تاریخچه"],
    ["🔙 منوی کاربران"]
  );

  return Markup.keyboard(keyboard).resize();
}

async function requireUsersPermission(ctx) {
  const telegramId = ctx.from?.id;

  if (!telegramId) return null;

  const admin = await adminService.getAdminByTelegramId(
    telegramId
  );

  if (!admin || !admin.is_active) {
    await ctx.reply("⛔ حساب مدیریتی شما فعال نیست.");
    return null;
  }

  const allowed = await adminService.hasPermission(
    admin.user_id,
    "users"
  );

  if (!allowed) {
    await ctx.reply("⛔ دسترسی مدیریت کاربران را ندارید.");
    return null;
  }

  return admin;
}

async function showHistory(ctx, page = 0) {
  const admin = await requireUsersPermission(ctx);
  if (!admin) return;

  try {
    const total = await adminActionLogService.getTotalCount();

    if (total === 0) {
      clearState(ctx.from.id);

      await ctx.reply(
        "📚 تاریخچه اقدامات مدیران\n\nهنوز هیچ اقدامی ثبت نشده است.",
        Markup.keyboard([
          ["🔄 بروزرسانی تاریخچه"],
          ["🔙 منوی کاربران"],
        ]).resize()
      );

      return;
    }

    const totalPages = Math.ceil(total / PAGE_SIZE);

    const safePage = Math.min(
      Math.max(Number(page) || 0, 0),
      totalPages - 1
    );

    const entries = await adminActionLogService.getHistory({
      limit: PAGE_SIZE,
      offset: safePage * PAGE_SIZE,
    });

    if (!entries.length) {
      await ctx.reply("❌ سوابقی برای این صفحه پیدا نشد.");
      return;
    }

    const lines = entries.map((entry, index) => {
      const action =
        ACTION_LABELS[entry.action] || entry.action;

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
    });

    await ctx.reply(
      "📚 تاریخچه اقدامات مدیران\n\n" +
      `📊 تعداد کل اقدامات: ${total}\n` +
      `📄 صفحه ${safePage + 1} از ${totalPages}\n\n` +
      lines.join("\n\n"),
      historyMenu(safePage, totalPages)
    );
  } catch (error) {
    console.error("Admin action history failed:", error);

    await ctx.reply(
      "❌ دریافت تاریخچه اقدامات انجام نشد."
    );
  }
}

async function handleText(ctx, next) {
  const state = getState(ctx.from.id);

  if (!state || state.step !== "adminActionHistory") {
    return next();
  }

  const text = ctx.message?.text || "";

  if (text === "🔙 منوی کاربران") {
    clearState(ctx.from.id);
    return next();
  }

  if (text === "🔄 بروزرسانی تاریخچه") {
    return showHistory(ctx, 0);
  }

  if (text === "⬅️ صفحه قبل تاریخچه") {
    return showHistory(ctx, state.page - 1);
  }

  if (text === "➡️ صفحه بعد تاریخچه") {
    return showHistory(ctx, state.page + 1);
  }

  return next();
}

function createAdminActionLogsHandler(bot) {
  bot.hears(
    "📚 تاریخچه اقدامات مدیران",
    (ctx) => showHistory(ctx, 0)
  );

  bot.on("text", handleText);
}

module.exports = {
  createAdminActionLogsHandler,
};
