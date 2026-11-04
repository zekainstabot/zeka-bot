
const { Markup } = require("telegraf");

const adminService = require("../services/admin.service");
const userRepository = require("../repositories/user.repository");
const creditService = require("../services/credit.service");
const adminUserCreditService = require("../services/admin-user-credit.service");
const adminProService = require("../services/admin-pro.service");
const adminActionLogService = require("../services/admin-action-log.service");
const { getClient } = require("../database/client");

const states = new Map();

const MENU_BUTTONS = [
  "👥 کاربران",
  "👥 مدیریت کاربران",
];

const PAGE_SIZE = 10;

function setState(userId, state) {
  states.set(String(userId), state);
}

function getState(userId) {
  return states.get(String(userId)) || null;
}

function clearState(userId) {
  states.delete(String(userId));
}

async function logAdminAction(data) {
  try {
    await adminActionLogService.recordAction(data);
  } catch (error) {
    console.error("Admin action log failed:", error);
  }
}

function getBackButton(admin) {
  return admin?.role_key === "super_admin"
    ? "🔙 پنل Super Admin"
    : "🔙 پنل ادمین";
}

function mainMenu(admin) {
  return Markup.keyboard([
    ["🔎 جستجوی کاربر"],
    ["📋 لیست کاربران"],
    ["🆕 کاربران جدید", "🟢 کاربران فعال"],
    ["💎 کاربران Pro"],
    ["📊 آمار کاربران"],
    [getBackButton(admin)],
  ]).resize();
}

function profileMenu(user = null) {
  const keyboard = [
    ["➕ افزایش اعتبار", "➖ کاهش اعتبار"],
    ["📜 تاریخچه اعتبار"],
    ["🟢 روشن کردن Pro", "🔴 خاموش کردن Pro"],
  ];

  if (user) {
    if (user.is_blocked) {
      keyboard.push(["🔓 آزاد کردن کاربر"]);
    } else {
      keyboard.push(["🚫 مسدود کردن کاربر"]);
    }
  }

  keyboard.push(
    ["🔎 جستجوی کاربر"],
    ["🔙 منوی کاربران"]
  );

  return Markup.keyboard(keyboard).resize();
}

function listMenu(page, totalPages) {
  const buttons = [];

  if (page > 0) {
    buttons.push("⬅️ صفحه قبل");
  }

  if (page < totalPages - 1) {
    buttons.push("➡️ صفحه بعد");
  }

  const keyboard = [];

  if (buttons.length) {
    keyboard.push(buttons);
  }

  keyboard.push(
    ["🔎 جستجوی کاربر"],
    ["🔙 منوی کاربران"]
  );

  return Markup.keyboard(keyboard).resize();
}

function searchMenu() {
  return Markup.keyboard([
    ["❌ لغو"],
    ["🔙 منوی کاربران"],
  ]).resize();
}

function amountMenu() {
  return Markup.keyboard([
    ["❌ لغو"],
    ["🔙 منوی کاربران"],
  ]).resize();
}

function blockReasonMenu() {
  return Markup.keyboard([
    ["❌ لغو"],
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
      "users"
    );

  if (!allowed) {
    await ctx.reply(
      "⛔ شما دسترسی مدیریت کاربران را ندارید."
    );
    return null;
  }

  return admin;
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

async function showUser(ctx, user, admin) {
  if (!user) {
    await ctx.reply(
      "❌ کاربر پیدا نشد.",
      mainMenu(admin)
    );
    return;
  }

  let balance = 0;

  try {
    balance =
      await creditService.getBalance(user.id);
  } catch (error) {
    console.error(
      "Admin user credit lookup failed:",
      error
    );
  }

  const username = user.username
    ? `@${user.username}`
    : "ثبت نشده";

  const name =
    user.display_name ||
    user.first_name ||
    "بدون نام";

  const proStatus =
    user.is_pro
      ? "🟢 فعال"
      : "🔴 غیرفعال";

  const blockStatus =
    user.is_blocked
      ? "🚫 مسدود"
      : "🟢 آزاد";

  const message =
    "👤 اطلاعات کاربر\n\n" +
    `🆔 شناسه داخلی: ${user.id}\n` +
    `📱 Telegram ID: ${user.telegram_user_id}\n` +
    `👤 نام: ${name}\n` +
    `🔹 Username: ${username}\n` +
    `💳 اعتبار: ${balance}\n` +
    `💎 Pro: ${proStatus}\n` +
    `🚦 وضعیت حساب: ${blockStatus}\n` +
    `📝 دلیل مسدودی: ${user.blocked_reason || "ندارد"}\n` +
    `📅 تاریخ مسدودی: ${formatDate(user.blocked_at)}\n` +
    `📅 انقضای Pro: ${formatDate(user.pro_expires_at)}\n` +
    `⭐ XP: ${user.xp || 0}\n` +
    `🏆 Level: ${user.level || 0}\n` +
    `🔥 Streak: ${user.streak_days || 0}\n` +
    `🌐 زبان: ${user.language || "fa"}\n` +
    `📅 ثبت‌نام: ${formatDate(user.created_at)}\n` +
    `🕐 آخرین فعالیت: ${formatDate(user.last_active_at)}`;

  setState(ctx.from.id, {
    step: "userProfile",
    userId: user.id,
    telegramUserId: user.telegram_user_id,
  });

  await ctx.reply(
    message,
    profileMenu(user)
  );
}

async function searchUser(ctx, value, admin) {
  const query = String(value || "").trim();

  if (!query) {
    await ctx.reply(
      "❌ مقدار جستجو خالی است."
    );
    return;
  }

  let user = null;

  try {
    if (/^\d+$/.test(query)) {
      user =
        await userRepository.findByTelegramId(query);

      if (!user) {
        user =
          await userRepository.findById(Number(query));
      }
    } else {
      const username = query.startsWith("@")
        ? query.slice(1)
        : query;

      if (
        typeof userRepository.findByUsername ===
        "function"
      ) {
        user =
          await userRepository.findByUsername(username);
      }
    }

    await showUser(ctx, user, admin);
  } catch (error) {
    console.error(
      "Admin user search failed:",
      error
    );

    await ctx.reply(
      "❌ جستجوی کاربر انجام نشد.",
      mainMenu(admin)
    );
  }
}

async function showUserStats(ctx, admin) {
  try {
    const db = getClient();

    const result = await db.query(`
      SELECT
        COUNT(*)::int AS total_users,

        COUNT(*) FILTER (
          WHERE created_at >= CURRENT_DATE
        )::int AS today_users,

        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '7 days'
        )::int AS week_users,

        COUNT(*) FILTER (
          WHERE last_active_at >= NOW() - INTERVAL '24 hours'
        )::int AS active_24h,

        COUNT(*) FILTER (
          WHERE last_active_at >= NOW() - INTERVAL '7 days'
        )::int AS active_7d,

        COUNT(*) FILTER (
          WHERE is_pro = TRUE
        )::int AS pro_users

      FROM users
    `);

    const stats = result.rows[0] || {};

    clearState(ctx.from.id);

    await ctx.reply(
      "📊 آمار کاربران\n\n" +
      `👥 کل کاربران: ${stats.total_users || 0}\n` +
      `🆕 ثبت‌نام امروز: ${stats.today_users || 0}\n` +
      `📅 ثبت‌نام ۷ روز اخیر: ${stats.week_users || 0}\n` +
      `🟢 فعال در ۲۴ ساعت اخیر: ${stats.active_24h || 0}\n` +
      `🟢 فعال در ۷ روز اخیر: ${stats.active_7d || 0}\n` +
      `💎 کاربران Pro: ${stats.pro_users || 0}`,
      mainMenu(admin)
    );
  } catch (error) {
    console.error(
      "Admin user stats failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت آمار کاربران انجام نشد.",
      mainMenu(admin)
    );
  }
}

async function showUserList(ctx, filter, page = 0) {
  const admin = await requirePermission(ctx);

  if (!admin) {
    return;
  }

  const filters = {
    all: {
      title: "📋 فهرست همه کاربران",
      where: "",
    },
    new: {
      title: "🆕 کاربران جدید",
      where: "WHERE created_at >= NOW() - INTERVAL '7 days'",
    },
    active: {
      title: "🟢 کاربران فعال",
      where: "WHERE last_active_at >= NOW() - INTERVAL '7 days'",
    },
    pro: {
      title: "💎 کاربران Pro",
      where: "WHERE is_pro = TRUE",
    },
  };

  const selected = filters[filter];

  if (!selected) {
    await ctx.reply(
      "❌ نوع فهرست نامعتبر است.",
      mainMenu(admin)
    );
    return;
  }

  try {
    const db = getClient();

    const countResult = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM users
      ${selected.where}
    `);

    const total = Number(countResult.rows[0]?.total || 0);
    const totalPages = Math.max(
      1,
      Math.ceil(total / PAGE_SIZE)
    );

    const safePage = Math.min(
      Math.max(Number(page) || 0, 0),
      totalPages - 1
    );

    const offset = safePage * PAGE_SIZE;

    const result = await db.query(`
      SELECT
        id,
        telegram_user_id,
        username,
        display_name,
        is_pro,
        created_at,
        last_active_at
      FROM users
      ${selected.where}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [PAGE_SIZE, offset]);

    if (!result.rows.length) {
      clearState(ctx.from.id);

      await ctx.reply(
        `${selected.title}\n\nکاربری در این فهرست وجود ندارد.`,
        mainMenu(admin)
      );
      return;
    }

    const lines = result.rows.map((user, index) => {
      const number = offset + index + 1;

      const name =
        user.display_name ||
        (user.username ? `@${user.username}` : "بدون نام");

      const pro = user.is_pro ? "💎" : "";

      return (
        `${number}. ${name} ${pro}\n` +
        `   شناسه: ${user.telegram_user_id}\n` +
        `   تاریخ عضویت: ${formatDate(user.created_at)}`
      );
    });

    const message =
      `${selected.title}\n` +
      `تعداد کل: ${total}\n` +
      `صفحه ${safePage + 1} از ${totalPages}\n\n` +
      lines.join("\n\n") +
      "\n\nبرای مشاهده جزئیات هر کاربر، از جستجوی کاربر و شناسه او استفاده کن.";

    setState(ctx.from.id, {
      step: "userList",
      filter,
      page: safePage,
      totalPages,
    });

    await ctx.reply(
      message,
      listMenu(safePage, totalPages)
    );
  } catch (error) {
    console.error(
      "Admin user list failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت فهرست کاربران انجام نشد.",
      mainMenu(admin)
    );
  }
}

async function handleUserMenu(ctx) {
  const admin = await requirePermission(ctx);

  if (!admin) {
    return;
  }

  clearState(ctx.from.id);

  await ctx.reply(
    "👥 کاربران\n\nبخش موردنظر را انتخاب کن.",
    mainMenu(admin)
  );
}

async function handleSearchStart(ctx) {
  const admin = await requirePermission(ctx);

  if (!admin) {
    return;
  }

  setState(ctx.from.id, {
    step: "searchUser",
  });

  await ctx.reply(
    "🔎 جستجوی کاربر\n\n" +
    "Telegram ID، شناسه داخلی یا Username کاربر را ارسال کن.",
    searchMenu()
  );
}

async function handleAmountStart(ctx, operation) {
  const admin = await requirePermission(ctx);

  if (!admin) {
    return;
  }

  const state = getState(ctx.from.id);

  if (!state || state.step !== "userProfile") {
    await ctx.reply(
      "ابتدا یک کاربر را جستجو کن."
    );
    return;
  }

  setState(ctx.from.id, {
    step: "creditAmount",
    operation,
    userId: state.userId,
    telegramUserId: state.telegramUserId,
  });

  const title = operation === "add"
    ? "➕ افزایش اعتبار"
    : "➖ کاهش اعتبار";

  await ctx.reply(
    `${title}\n\nمقدار اعتبار را به عدد ارسال کن:`,
    amountMenu()
  );
}

async function handleCreditAmount(ctx, value, state) {
  const admin = await requirePermission(ctx);

  if (!admin) {
    return;
  }

  const amount = Number(
    String(value).replace(/,/g, ".").trim()
  );

  if (!Number.isFinite(amount) || amount <= 0) {
    await ctx.reply(
      "❌ مقدار نامعتبر است. یک عدد مثبت ارسال کن."
    );
    return;
  }

  try {
    let result;

    if (state.operation === "add") {
      result = await adminUserCreditService.addCredit({
        userId: state.userId,
        amount,
        adminTelegramId: ctx.from.id,
      });
    } else {
      result = await adminUserCreditService.removeCredit({
        userId: state.userId,
        amount,
        adminTelegramId: ctx.from.id,
      });
    }

    await logAdminAction({
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
      },
    });

    clearState(ctx.from.id);

    const title = state.operation === "add"
      ? "✅ اعتبار با موفقیت افزایش یافت."
      : "✅ اعتبار با موفقیت کاهش یافت.";

    await ctx.reply(
      `${title}\n\n` +
      `👤 Telegram ID: ${state.telegramUserId}\n` +
      `💳 مقدار تغییر: ${result.amount}\n` +
      `📉 موجودی قبل: ${result.balanceBefore}\n` +
      `📈 موجودی بعد: ${result.balanceAfter}`,
      Markup.keyboard([
        ["🔎 جستجوی کاربر"],
        ["🔙 منوی کاربران"],
      ]).resize()
    );
  } catch (error) {
    console.error(
      "Admin credit adjustment failed:",
      error
    );

    let message = "❌ عملیات تغییر اعتبار انجام نشد.";

    if (error.message === "INSUFFICIENT_CREDIT") {
      message =
        "❌ موجودی کاربر برای این مقدار کاهش اعتبار کافی نیست.";
    } else if (error.message === "INVALID_AMOUNT") {
      message = "❌ مقدار اعتبار نامعتبر است.";
    } else if (error.message === "AMOUNT_TOO_LARGE") {
      message = "❌ مقدار واردشده بیش از حد مجاز است.";
    }

    clearState(ctx.from.id);

    await ctx.reply(
      message,
      Markup.keyboard([
        ["🔎 جستجوی کاربر"],
        ["🔙 منوی کاربران"],
      ]).resize()
    );
  }
}

async function handleProfileProAction(ctx, action) {
  const admin = await requirePermission(ctx);

  if (!admin) {
    return;
  }

  const state = getState(ctx.from.id);

  if (
    !state ||
    state.step !== "userProfile" ||
    !state.telegramUserId
  ) {
    await ctx.reply(
      "ابتدا یک کاربر را جستجو کن."
    );
    return;
  }

  try {
    if (action === "enable") {
      await adminProService.enablePro({
        telegramUserId: ctx.from.id,
        targetTelegramUserId: state.telegramUserId,
      });
    } else {
      await adminProService.disablePro({
        telegramUserId: ctx.from.id,
        targetTelegramUserId: state.telegramUserId,
      });
    }

    await logAdminAction({
      adminUserId: admin.user_id,
      adminTelegramUserId: ctx.from.id,
      targetUserId: state.userId,
      targetTelegramUserId: state.telegramUserId,
      action: action === "enable"
        ? "PRO_ENABLE"
        : "PRO_DISABLE",
      details: {},
    });

    const updatedUser =
      await userRepository.findById(state.userId);

    await ctx.reply(
      action === "enable"
        ? "🟢 اشتراک Pro کاربر روشن شد."
        : "🔴 اشتراک Pro کاربر خاموش شد."
    );

    await showUser(ctx, updatedUser, admin);
  } catch (error) {
    console.error(
      "Admin profile Pro action failed:",
      error
    );

    let message = "❌ تغییر وضعیت Pro انجام نشد.";

    if (error.code === "PRO_EXPIRED") {
      message =
        "⚠️ اشتراک این کاربر منقضی شده است.\nبرای فعال‌سازی مجدد از بخش مدیریت Pro و گزینه فعال‌سازی یا تمدید استفاده کن.";
    } else if (error.code === "PERMISSION_DENIED") {
      message =
        "⛔ برای تغییر اشتراک Pro به مجوز مدیریت Pro نیاز داری.";
    } else if (error.code === "ADMIN_ACCESS_DENIED") {
      message =
        "⛔ حساب مدیریتی شما فعال نیست.";
    } else if (error.code === "USER_NOT_FOUND") {
      message =
        "❌ کاربر در سیستم Pro پیدا نشد.";
    }

    await ctx.reply(
      message,
      profileMenu()
    );
  }
}

async function handleProfileBlockAction(ctx) {
  const admin = await requirePermission(ctx);

  if (!admin) {
    return;
  }

  const state = getState(ctx.from.id);

  if (
    !state ||
    state.step !== "userProfile" ||
    !state.userId
  ) {
    await ctx.reply(
      "ابتدا یک کاربر را جستجو کن."
    );
    return;
  }

  try {
    const user =
      await userRepository.findById(state.userId);

    if (!user) {
      clearState(ctx.from.id);

      await ctx.reply(
        "❌ کاربر پیدا نشد."
      );
      return;
    }

    if (user.is_blocked) {
      await ctx.reply(
        "این کاربر از قبل مسدود شده است.",
        profileMenu(user)
      );
      return;
    }

    const targetAdmin =
      await adminService.getAdminByTelegramId(
        user.telegram_user_id
      );

    if (targetAdmin) {
      await ctx.reply(
        "⛔ امکان مسدودسازی حساب‌های مدیریتی وجود ندارد.",
        profileMenu(user)
      );
      return;
    }

    setState(ctx.from.id, {
      step: "blockReason",
      userId: user.id,
      telegramUserId: user.telegram_user_id,
    });

    await ctx.reply(
      "🚫 مسدودسازی کاربر\n\n" +
      "دلیل مسدودسازی این کاربر را ارسال کن:",
      blockReasonMenu()
    );
  } catch (error) {
    console.error(
      "Admin block user start failed:",
      error
    );

    await ctx.reply(
      "❌ شروع عملیات مسدودسازی انجام نشد."
    );
  }
}

async function handleBlockReason(ctx, reason, state) {
  const admin = await requirePermission(ctx);

  if (!admin) {
    return;
  }

  const cleanReason = String(reason || "").trim();

  if (!cleanReason) {
    await ctx.reply(
      "❌ دلیل مسدودسازی نمی‌تواند خالی باشد. دلیل را ارسال کن."
    );
    return;
  }

  if (cleanReason.length > 500) {
    await ctx.reply(
      "❌ دلیل مسدودسازی نباید بیشتر از ۵۰۰ کاراکتر باشد."
    );
    return;
  }

  try {
    const user =
      await userRepository.findById(state.userId);

    if (!user) {
      clearState(ctx.from.id);

      await ctx.reply(
        "❌ کاربر پیدا نشد."
      );
      return;
    }

    if (user.is_blocked) {
      clearState(ctx.from.id);

      await ctx.reply(
        "این کاربر قبلاً مسدود شده است."
      );

      await showUser(ctx, user, admin);
      return;
    }

    const targetAdmin =
      await adminService.getAdminByTelegramId(
        user.telegram_user_id
      );

    if (targetAdmin) {
      clearState(ctx.from.id);

      await ctx.reply(
        "⛔ امکان مسدودسازی حساب‌های مدیریتی وجود ندارد."
      );

      await showUser(ctx, user, admin);
      return;
    }

    const db = getClient();

    const result = await db.query(
      `
        UPDATE users
        SET
          is_blocked = TRUE,
          blocked_at = NOW(),
          blocked_reason = $2,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [state.userId, cleanReason]
    );

    const updatedUser = result.rows[0];

    if (!updatedUser) {
      clearState(ctx.from.id);

      await ctx.reply(
        "❌ کاربر برای مسدودسازی پیدا نشد."
      );
      return;
    }

    await logAdminAction({
      adminUserId: admin.user_id,
      adminTelegramUserId: ctx.from.id,
      targetUserId: updatedUser.id,
      targetTelegramUserId: updatedUser.telegram_user_id,
      action: "USER_BLOCK",
      details: {
        reason: cleanReason,
      },
    });

    clearState(ctx.from.id);

    await ctx.reply(
      "✅ کاربر با موفقیت مسدود شد."
    );

    await showUser(ctx, updatedUser, admin);
  } catch (error) {
    console.error(
      "Admin block user failed:",
      error
    );

    clearState(ctx.from.id);

    await ctx.reply(
      "❌ مسدودسازی کاربر انجام نشد."
    );
  }
}

async function handleProfileUnblockAction(ctx) {
  const admin = await requirePermission(ctx);

  if (!admin) {
    return;
  }

  const state = getState(ctx.from.id);

  if (
    !state ||
    state.step !== "userProfile" ||
    !state.userId
  ) {
    await ctx.reply(
      "ابتدا یک کاربر را جستجو کن."
    );
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
        RETURNING *
      `,
      [state.userId]
    );

    const updatedUser = result.rows[0];

    if (!updatedUser) {
      clearState(ctx.from.id);

      await ctx.reply(
        "❌ کاربر پیدا نشد."
      );
      return;
    }

    await logAdminAction({
      adminUserId: admin.user_id,
      adminTelegramUserId: ctx.from.id,
      targetUserId: updatedUser.id,
      targetTelegramUserId: updatedUser.telegram_user_id,
      action: "USER_UNBLOCK",
      details: {},
    });

    await ctx.reply(
      "✅ محدودیت حساب کاربر برداشته شد."
    );

    await showUser(ctx, updatedUser, admin);
  } catch (error) {
    console.error(
      "Admin unblock user failed:",
      error
    );

    await ctx.reply(
      "❌ آزادسازی کاربر انجام نشد."
    );
  }
}

async function showCreditHistory(ctx) {
  const admin = await requirePermission(ctx);

  if (!admin) {
    return;
  }

  const state = getState(ctx.from.id);

  if (!state || !state.userId) {
    await ctx.reply(
      "ابتدا یک کاربر را جستجو کن.",
      mainMenu(admin)
    );
    return;
  }

  try {
    const history =
      await adminUserCreditService.getHistory(
        state.userId,
        10
      );

    if (!history.length) {
      const user =
        await userRepository.findById(state.userId);

      await ctx.reply(
        "📜 برای این کاربر سابقه اعتباری ثبت نشده است.",
        profileMenu(user)
      );
      return;
    }

    const lines = history.map((entry, index) => {
      const amount = Number(entry.amount);
      const sign = amount > 0 ? "+" : "";

      return (
        `${index + 1}. ${entry.entry_type}\n` +
        `💳 مقدار: ${sign}${amount}\n` +
        `📊 موجودی قبل: ${entry.balance_before ?? "نامشخص"}\n` +
        `📊 موجودی بعد: ${entry.balance_after ?? "نامشخص"}\n` +
        `📝 توضیح: ${entry.description || "ندارد"}\n` +
        `📅 تاریخ: ${formatDate(entry.created_at)}`
      );
    });

    const user =
      await userRepository.findById(state.userId);

    await ctx.reply(
      "📜 تاریخچه اعتبار کاربر\n\n" +
      lines.join("\n\n"),
      profileMenu(user)
    );
  } catch (error) {
    console.error(
      "Admin credit history failed:",
      error
    );

    const user =
      await userRepository.findById(state.userId);

    await ctx.reply(
      "❌ دریافت تاریخچه اعتبار انجام نشد.",
      profileMenu(user)
    );
  }
}

async function handleBack(ctx) {
  clearState(ctx.from.id);
  await handleUserMenu(ctx);
}

async function handlePageChange(ctx, direction) {
  const state = getState(ctx.from.id);

  if (!state || state.step !== "userList") {
    return;
  }

  let nextPage = state.page;

  if (direction === "next") {
    nextPage += 1;
  } else {
    nextPage -= 1;
  }

  if (
    nextPage < 0 ||
    nextPage >= state.totalPages
  ) {
    return;
  }

  await showUserList(
    ctx,
    state.filter,
    nextPage
  );
}

async function handleText(ctx) {
  const state = getState(ctx.from.id);

  if (!state) {
    return false;
  }

  const text = ctx.message?.text || "";

  if (text === "❌ لغو") {
    clearState(ctx.from.id);

    const admin = await requirePermission(ctx);

    if (admin) {
      await ctx.reply(
        "❌ عملیات لغو شد.",
        mainMenu(admin)
      );
    }

    return true;
  }

  if (text === "🔙 منوی کاربران") {
    await handleBack(ctx);
    return true;
  }

  if (state.step === "searchUser") {
    const admin = await requirePermission(ctx);

    if (admin) {
      await searchUser(ctx, text, admin);
    }

    return true;
  }

  if (state.step === "creditAmount") {
    await handleCreditAmount(ctx, text, state);
    return true;
  }

  if (state.step === "blockReason") {
    await handleBlockReason(ctx, text, state);
    return true;
  }

  return false;
}

function createAdminUsersHandler(bot) {
  for (const button of MENU_BUTTONS) {
    bot.hears(button, handleUserMenu);
  }

  bot.hears(
    "🔎 جستجوی کاربر",
    handleSearchStart
  );

  bot.hears(
    "📋 لیست کاربران",
    (ctx) => showUserList(ctx, "all", 0)
  );

  bot.hears(
    "🆕 کاربران جدید",
    (ctx) => showUserList(ctx, "new", 0)
  );

  bot.hears(
    "🟢 کاربران فعال",
    (ctx) => showUserList(ctx, "active", 0)
  );

  bot.hears(
    "💎 کاربران Pro",
    (ctx) => showUserList(ctx, "pro", 0)
  );

  bot.hears(
    "📊 آمار کاربران",
    async (ctx) => {
      const admin = await requirePermission(ctx);

      if (admin) {
        clearState(ctx.from.id);
        await showUserStats(ctx, admin);
      }
    }
  );

  bot.hears(
    "➕ افزایش اعتبار",
    (ctx) => handleAmountStart(ctx, "add")
  );

  bot.hears(
    "➖ کاهش اعتبار",
    (ctx) => handleAmountStart(ctx, "remove")
  );

  bot.hears(
    "🟢 روشن کردن Pro",
    (ctx) => handleProfileProAction(ctx, "enable")
  );

  bot.hears(
    "🔴 خاموش کردن Pro",
    (ctx) => handleProfileProAction(ctx, "disable")
  );

  bot.hears(
    "🚫 مسدود کردن کاربر",
    handleProfileBlockAction
  );

  bot.hears(
    "🔓 آزاد کردن کاربر",
    handleProfileUnblockAction
  );

  bot.hears(
    "📜 تاریخچه اعتبار",
    showCreditHistory
  );

  bot.hears(
    "🔙 منوی کاربران",
    handleBack
  );

  bot.hears(
    "⬅️ صفحه قبل",
    (ctx) => handlePageChange(ctx, "previous")
  );

  bot.hears(
    "➡️ صفحه بعد",
    (ctx) => handlePageChange(ctx, "next")
  );

  bot.on("text", async (ctx, next) => {
    const handled = await handleText(ctx);

    if (handled) {
      return;
    }

    return next();
  });
}

module.exports = {
  createAdminUsersHandler,
};
