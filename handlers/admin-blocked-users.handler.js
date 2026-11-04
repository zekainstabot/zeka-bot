
const { Markup } = require("telegraf");
const { getClient } = require("../database/client");

const adminService = require("../services/admin.service");
const userRepository = require("../repositories/user.repository");
const adminActionLogService = require("../services/admin-action-log.service");

const PAGE_SIZE = 10;
const states = new Map();

function setState(telegramId, state) {
  states.set(String(telegramId), state);
}

function getState(telegramId) {
  return states.get(String(telegramId)) || null;
}

function clearState(telegramId) {
  states.delete(String(telegramId));
}

async function logAdminAction(data) {
  try {
    await adminActionLogService.recordAction(data);
  } catch (error) {
    console.error("Admin action log failed:", error);
  }
}

function formatDate(value) {
  if (!value) return "نامشخص";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "نامشخص";
  }

  return date.toLocaleString("fa-IR");
}

function blockedMenu(users, page, totalPages) {
  const keyboard = users.map((user) => [
    `👤 ${user.telegram_user_id}`,
  ]);

  const navigation = [];

  if (page > 0) {
    navigation.push("⬅️ صفحه قبل مسدودها");
  }

  if (page < totalPages - 1) {
    navigation.push("➡️ صفحه بعد مسدودها");
  }

  if (navigation.length) {
    keyboard.push(navigation);
  }

  keyboard.push(
    ["🔄 بروزرسانی فهرست"],
    ["🔙 منوی کاربران"]
  );

  return Markup.keyboard(keyboard).resize();
}

function blockedProfileMenu() {
  return Markup.keyboard([
    ["🔓 آزاد کردن این کاربر"],
    ["🔙 بازگشت به کاربران مسدود"],
    ["🔙 منوی کاربران"],
  ]).resize();
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

async function showBlockedUsers(ctx, page = 0) {
  const admin = await requireUsersPermission(ctx);
  if (!admin) return;

  try {
    const db = getClient();

    const countResult = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM users
      WHERE is_blocked = TRUE
    `);

    const total = Number(countResult.rows[0]?.total || 0);

    if (total === 0) {
      clearState(ctx.from.id);

      await ctx.reply(
        "🚫 کاربران مسدود\n\nهیچ کاربر مسدودشده‌ای وجود ندارد.",
        Markup.keyboard([
          ["🔄 بروزرسانی فهرست"],
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

    const offset = safePage * PAGE_SIZE;

    const result = await db.query(
      `
        SELECT
          id,
          telegram_user_id,
          username,
          display_name,
          blocked_reason,
          blocked_at
        FROM users
        WHERE is_blocked = TRUE
        ORDER BY blocked_at DESC NULLS LAST, id DESC
        LIMIT $1 OFFSET $2
      `,
      [PAGE_SIZE, offset]
    );

    const users = result.rows;

    const lines = users.map((user, index) => {
      const name =
        user.display_name ||
        (user.username ? `@${user.username}` : "بدون نام");

      return (
        `${offset + index + 1}. ${name}\n` +
        `🆔 ${user.telegram_user_id}\n` +
        `📝 ${user.blocked_reason || "بدون دلیل ثبت‌شده"}\n` +
        `📅 ${formatDate(user.blocked_at)}`
      );
    });

    setState(ctx.from.id, {
      step: "blockedList",
      page: safePage,
      totalPages,
    });

    await ctx.reply(
      "🚫 کاربران مسدود\n\n" +
      `👥 تعداد کل: ${total}\n` +
      `📄 صفحه ${safePage + 1} از ${totalPages}\n\n` +
      lines.join("\n\n") +
      "\n\nبرای مشاهده پروفایل، دکمه شناسه کاربر را انتخاب کن.",
      blockedMenu(users, safePage, totalPages)
    );
  } catch (error) {
    console.error("Blocked users list failed:", error);

    await ctx.reply(
      "❌ دریافت فهرست کاربران مسدود انجام نشد."
    );
  }
}

async function showBlockedProfile(ctx, telegramUserId) {
  const admin = await requireUsersPermission(ctx);
  if (!admin) return;

  try {
    const user = await userRepository.findByTelegramId(
      String(telegramUserId)
    );

    if (!user || !user.is_blocked) {
      await ctx.reply(
        "❌ این کاربر پیدا نشد یا دیگر مسدود نیست."
      );

      await showBlockedUsers(ctx, 0);
      return;
    }

    setState(ctx.from.id, {
      step: "blockedProfile",
      userId: user.id,
      telegramUserId: user.telegram_user_id,
    });

    const name =
      user.display_name ||
      user.first_name ||
      "بدون نام";

    await ctx.reply(
      "👤 پروفایل کاربر مسدود\n\n" +
      `🆔 شناسه داخلی: ${user.id}\n` +
      `📱 Telegram ID: ${user.telegram_user_id}\n` +
      `👤 نام: ${name}\n` +
      `🔹 Username: ${user.username ? `@${user.username}` : "ثبت نشده"}\n` +
      `📝 دلیل مسدودی: ${user.blocked_reason || "ثبت نشده"}\n` +
      `📅 تاریخ مسدودی: ${formatDate(user.blocked_at)}\n` +
      `💎 وضعیت Pro: ${user.is_pro ? "فعال" : "غیرفعال"}`,
      blockedProfileMenu()
    );
  } catch (error) {
    console.error("Blocked user profile failed:", error);
    await ctx.reply("❌ دریافت پروفایل کاربر انجام نشد.");
  }
}

async function unblockSelectedUser(ctx) {
  const admin = await requireUsersPermission(ctx);
  if (!admin) return;

  const state = getState(ctx.from.id);

  if (!state || state.step !== "blockedProfile") {
    await ctx.reply("ابتدا یک کاربر مسدود را انتخاب کن.");
    return;
  }

  try {
    const db = getClient();

    const result = await db.query(
      `
        UPDATE users
        SET
          is_blocked = FALSE,
          blocked_at = NULL,
          blocked_reason = NULL,
          updated_at = NOW()
        WHERE id = $1
          AND is_blocked = TRUE
        RETURNING id, telegram_user_id
      `,
      [state.userId]
    );

    if (!result.rows.length) {
      clearState(ctx.from.id);

      await ctx.reply(
        "❌ کاربر پیدا نشد یا قبلاً آزاد شده است."
      );

      await showBlockedUsers(ctx, 0);
      return;
    }

    const updatedUser = result.rows[0];

    await logAdminAction({
      adminUserId: admin.user_id,
      adminTelegramUserId: ctx.from.id,
      targetUserId: updatedUser.id,
      targetTelegramUserId: updatedUser.telegram_user_id,
      action: "USER_UNBLOCK",
      details: {
        source: "blocked_users_panel",
      },
    });

    clearState(ctx.from.id);

    await ctx.reply(
      `✅ حساب کاربر ${updatedUser.telegram_user_id} آزاد شد.`
    );

    await showBlockedUsers(ctx, 0);
  } catch (error) {
    console.error("Unblock selected user failed:", error);
    await ctx.reply("❌ آزادسازی حساب انجام نشد.");
  }
}

async function handleText(ctx, next) {
  const state = getState(ctx.from.id);

  if (!state) {
    return next();
  }

  const text = ctx.message?.text || "";

  if (text === "🔙 منوی کاربران") {
    clearState(ctx.from.id);
    return next();
  }

  if (text === "🔙 بازگشت به کاربران مسدود") {
    return showBlockedUsers(ctx, 0);
  }

  if (text === "🔄 بروزرسانی فهرست") {
    return showBlockedUsers(ctx, 0);
  }

  if (text === "⬅️ صفحه قبل مسدودها") {
    if (state.step === "blockedList") {
      return showBlockedUsers(ctx, state.page - 1);
    }
  }

  if (text === "➡️ صفحه بعد مسدودها") {
    if (state.step === "blockedList") {
      return showBlockedUsers(ctx, state.page + 1);
    }
  }

  if (text === "🔓 آزاد کردن این کاربر") {
    if (state.step === "blockedProfile") {
      return unblockSelectedUser(ctx);
    }
  }

  if (state.step === "blockedList") {
    const match = text.match(/^👤\s*(\d+)$/);

    if (match) {
      return showBlockedProfile(ctx, match[1]);
    }
  }

  return next();
}

function createAdminBlockedUsersHandler(bot) {
  bot.hears(
    "🚫 کاربران مسدود",
    (ctx) => showBlockedUsers(ctx, 0)
  );

  bot.on("text", handleText);
}

module.exports = {
  createAdminBlockedUsersHandler,
};
