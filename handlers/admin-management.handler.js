const { Markup } = require("telegraf");

const adminService = require("../services/admin-management.service");
const adminCoreService = require("../services/admin.service");
const {
  setUserCommands,
} = require("../services/command.service");

const states = new Map();

const CANCEL_TEXT = "❌ لغو";

/*
 * =========================
 * Menus
 * =========================
 */

function adminManagementMenu() {
  return Markup.keyboard([
    ["➕ افزودن ادمین", "👥 لیست ادمین‌ها"],
    ["🔐 مدیریت سطح دسترسی"],
    ["🟢 فعال کردن ادمین", "🔴 غیرفعال کردن ادمین"],
    ["🗑 حذف ادمین"],
    ["🔙 پنل Super Admin"],
  ])
    .resize()
    .oneTime(false);
}

function accessManagementMenu() {
  return Markup.keyboard([
    ["👤 انتخاب ادمین"],
    ["📋 مشاهده دسترسی‌ها"],
    ["🔄 تغییر سطح ادمین"],
    ["🔙 مدیریت ادمین"],
  ])
    .resize()
    .oneTime(false);
}

function cancelMenu() {
  return Markup.keyboard([
    [CANCEL_TEXT],
  ])
    .resize()
    .oneTime(false);
}

/*
 * =========================
 * Helpers
 * =========================
 */

async function requireSuperAdmin(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return false;
  }

  const admin =
    await adminCoreService.getAdminByTelegramId(
      telegramUserId
    );

  if (
    !admin ||
    !admin.is_active ||
    admin.role_key !== "super_admin"
  ) {
    await ctx.reply(
      "⛔ دسترسی غیرمجاز است."
    );

    return false;
  }

  return true;
}

function startState(
  ctx,
  action,
  extra = {}
) {
  states.set(
    String(ctx.from.id),
    {
      action,
      createdAt: Date.now(),
      ...extra,
    }
  );
}

function getState(ctx) {
  return states.get(
    String(ctx.from.id)
  );
}

function clearState(ctx) {
  states.delete(
    String(ctx.from.id)
  );
}

function isExpired(state) {
  if (!state?.createdAt) {
    return true;
  }

  return (
    Date.now() - state.createdAt >
    10 * 60 * 1000
  );
}

async function updateUserCommands(
  ctx,
  roleKey
) {
  try {
    await setUserCommands(
      ctx.telegram,
      ctx.from.id,
      roleKey
    );
  } catch (error) {
    console.error(
      "updateUserCommands error:",
      error
    );
  }
}

/*
 * =========================
 * Access
 * =========================
 */

async function showAdminAccess(
  ctx,
  telegramUserId
) {
  const result =
    await adminService.getAdminAccess(
      telegramUserId
    );

  if (!result) {
    await ctx.reply(
      "❌ ادمین پیدا نشد.",
      accessManagementMenu()
    );

    return;
  }

  const permissions =
    result.permissions || [];

  const roleTitle =
    result.role_title ||
    result.role_key ||
    "نامشخص";

  let message =
    `👤 ادمین: ${telegramUserId}\n` +
    `🔐 سطح: ${roleTitle}\n\n`;

  if (!permissions.length) {
    message +=
      "📋 هیچ دسترسی فعالی برای این سطح وجود ندارد.";
  } else {
    message +=
      "📋 دسترسی‌ها:\n\n";

    permissions.forEach(
      (permission, index) => {
        const name =
          permission.title ||
          permission.name ||
          permission.permission_key ||
          permission.key ||
          "نامشخص";

        message +=
          `${index + 1}. ${name}\n`;
      }
    );
  }

  await ctx.reply(
    message,
    accessManagementMenu()
  );
}

/*
 * =========================
 * Text State Handler
 * =========================
 */

async function handleAdminManagementText(
  ctx,
  next
) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return next();
  }

  const state =
    getState(ctx);

  if (!state) {
    return next();
  }

  /*
   * State expiration
   */
  if (isExpired(state)) {
    clearState(ctx);

    await ctx.reply(
      "⌛ زمان این عملیات تمام شده است.",
      adminManagementMenu()
    );

    return;
  }

  const text =
    ctx.message?.text?.trim();

  if (!text) {
    return next();
  }

  /*
   * این قسمت عمداً داخل handler عمومی هم هست
   * تا اگر somehow از hears عبور کرد،
   * باز هم لغو انجام شود.
   */
  if (
    text === CANCEL_TEXT ||
    text === "/cancel"
  ) {
    clearState(ctx);

    if (
      state.action === "access_select" ||
      state.action === "role_select" ||
      state.action === "role_apply"
    ) {
      await ctx.reply(
        "❌ عملیات لغو شد.",
        accessManagementMenu()
      );
    } else {
      await ctx.reply(
        "❌ عملیات لغو شد.",
        adminManagementMenu()
      );
    }

    return;
  }

  /*
   * =========================
   * Access → Select Admin
   * =========================
   */

  if (
    state.action ===
    "access_select"
  ) {
    const targetId = text;

    if (!/^\d+$/.test(targetId)) {
      await ctx.reply(
        "❌ شناسه تلگرام معتبر نیست.\n\nمثال:\n123456789",
        cancelMenu()
      );

      return;
    }

    state.targetUserId =
      Number(targetId);

    states.set(
      String(telegramUserId),
      state
    );

    if (
      state.nextAction ===
      "view_access"
    ) {
      clearState(ctx);

      await showAdminAccess(
        ctx,
        Number(targetId)
      );

      return;
    }

    if (
      state.nextAction ===
      "change_role"
    ) {
      state.action =
        "role_select";

      states.set(
        String(telegramUserId),
        state
      );

      const roles =
        await adminService.getRoles();

      if (!roles?.length) {
        clearState(ctx);

        await ctx.reply(
          "❌ هیچ سطح ادمینی پیدا نشد.",
          accessManagementMenu()
        );

        return;
      }

      let message =
        "🔄 سطح جدید را انتخاب کنید:\n\n";

      roles.forEach(
        (role, index) => {
          message +=
            `${index + 1}. ` +
            `${role.title || role.name || role.role_key}\n` +
            `   ${role.role_key}\n\n`;
        }
      );

      message +=
        "🔹 نام یا کلید سطح را ارسال کنید.";

      await ctx.reply(
        message,
        cancelMenu()
      );

      return;
    }

    return;
  }

  /*
   * =========================
   * Role Select
   * =========================
   */

  if (
    state.action ===
    "role_select"
  ) {
    const roles =
      await adminService.getRoles();

    const role =
      roles.find(
        (item) =>
          item.role_key === text ||
          item.name === text ||
          item.title === text
      );

    if (!role) {
      await ctx.reply(
        "❌ این سطح ادمینی پیدا نشد.\n\nیکی از کلیدهای سطح را ارسال کنید.",
        cancelMenu()
      );

      return;
    }

    state.action =
      "role_apply";

    state.roleKey =
      role.role_key;

    states.set(
      String(telegramUserId),
      state
    );

    await ctx.reply(
      `⚠️ سطح ادمین به «${
        role.title ||
        role.name ||
        role.role_key
      }» تغییر کند؟\n\n` +
        `👤 ادمین: ${state.targetUserId}\n` +
        `🔐 سطح: ${role.role_key}\n\n` +
        `برای تأیید همین سطح را ارسال کنید.`,
      cancelMenu()
    );

    return;
  }

  /*
   * =========================
   * Role Apply
   * =========================
   */

  if (
    state.action ===
    "role_apply"
  ) {
    if (
      text !== state.roleKey
    ) {
      await ctx.reply(
        `❌ مقدار صحیح را ارسال کنید:\n\n${state.roleKey}`,
        cancelMenu()
      );

      return;
    }

    const result =
      await adminService.changeAdminRole(
        state.targetUserId,
        state.roleKey
      );

    clearState(ctx);

    if (!result?.success) {
      await ctx.reply(
        result?.message ||
          "❌ تغییر سطح ادمین انجام نشد.",
        accessManagementMenu()
      );

      return;
    }

    await ctx.reply(
      "✅ سطح دسترسی ادمین با موفقیت تغییر کرد.",
      accessManagementMenu()
    );

    return;
  }

  /*
   * =========================
   * Add Admin
   * =========================
   */

  if (
    state.action ===
    "add_admin"
  ) {
    if (!/^\d+$/.test(text)) {
      await ctx.reply(
        "❌ شناسه تلگرام معتبر نیست.",
        cancelMenu()
      );

      return;
    }

    const result =
      await adminService.addAdmin(
        Number(text)
      );

    clearState(ctx);

    if (!result?.success) {
      await ctx.reply(
        result?.message ||
          "❌ افزودن ادمین انجام نشد.",
        adminManagementMenu()
      );

      return;
    }

    await ctx.reply(
      "✅ ادمین با موفقیت اضافه شد.",
      adminManagementMenu()
    );

    return;
  }

  /*
   * =========================
   * Enable Admin
   * =========================
   */

  if (
    state.action ===
    "enable_admin"
  ) {
    if (!/^\d+$/.test(text)) {
      await ctx.reply(
        "❌ شناسه تلگرام معتبر نیست.",
        cancelMenu()
      );

      return;
    }

    const result =
      await adminService.setAdminActive(
        Number(text),
        true
      );

    clearState(ctx);

    if (!result?.success) {
      await ctx.reply(
        result?.message ||
          "❌ فعال‌سازی انجام نشد.",
        adminManagementMenu()
      );

      return;
    }

    await ctx.reply(
      "🟢 ادمین فعال شد.",
      adminManagementMenu()
    );

    return;
  }

  /*
   * =========================
   * Disable Admin
   * =========================
   */

  if (
    state.action ===
    "disable_admin"
  ) {
    if (!/^\d+$/.test(text)) {
      await ctx.reply(
        "❌ شناسه تلگرام معتبر نیست.",
        cancelMenu()
      );

      return;
    }

    const result =
      await adminService.setAdminActive(
        Number(text),
        false
      );

    clearState(ctx);

    if (!result?.success) {
      await ctx.reply(
        result?.message ||
          "❌ غیرفعال‌سازی انجام نشد.",
        adminManagementMenu()
      );

      return;
    }

    await ctx.reply(
      "🔴 ادمین غیرفعال شد.",
      adminManagementMenu()
    );

    return;
  }

  /*
   * =========================
   * Remove Admin
   * =========================
   */

  if (
    state.action ===
    "remove_admin"
  ) {
    if (!/^\d+$/.test(text)) {
      await ctx.reply(
        "❌ شناسه تلگرام معتبر نیست.",
        cancelMenu()
      );

      return;
    }

    const result =
      await adminService.removeAdmin(
        Number(text)
      );

    clearState(ctx);

    if (!result?.success) {
      await ctx.reply(
        result?.message ||
          "❌ حذف ادمین انجام نشد.",
        adminManagementMenu()
      );

      return;
    }

    await ctx.reply(
      "🗑 ادمین حذف شد.",
      adminManagementMenu()
    );

    return;
  }

  return next();
}

/*
 * =========================
 * Main Handler
 * =========================
 */

function createAdminManagementHandler(
  bot
) {
  /*
   * Main admin management
   */
  bot.hears(
    "🛠 مدیریت ادمین",
    async (ctx) => {
      if (
        !(await requireSuperAdmin(ctx))
      ) {
        return;
      }

      clearState(ctx);

      await ctx.reply(
        "🛠 مدیریت ادمین",
        adminManagementMenu()
      );
    }
  );

  /*
   * Add admin
   */
  bot.hears(
    "➕ افزودن ادمین",
    async (ctx) => {
      if (
        !(await requireSuperAdmin(ctx))
      ) {
        return;
      }

      startState(
        ctx,
        "add_admin"
      );

      await ctx.reply(
        "👤 شناسه عددی تلگرام ادمین جدید را ارسال کنید.",
        cancelMenu()
      );
    }
  );

  /*
   * List admins
   */
  bot.hears(
    "👥 لیست ادمین‌ها",
    async (ctx) => {
      if (
        !(await requireSuperAdmin(ctx))
      ) {
        return;
      }

      clearState(ctx);

      const admins =
        await adminService.listAdmins();

      if (!admins?.length) {
        await ctx.reply(
          "📋 هیچ ادمینی ثبت نشده است.",
          adminManagementMenu()
        );

        return;
      }

      let message =
        "👥 لیست ادمین‌ها:\n\n";

      admins.forEach(
        (admin, index) => {
          const status =
            admin.is_active
              ? "🟢 فعال"
              : "🔴 غیرفعال";

          const role =
            admin.role_title ||
            admin.role_key ||
            "admin";

          message +=
            `${index + 1}. ` +
            `${admin.telegram_user_id}\n` +
            `   🔐 ${role}\n` +
            `   ${status}\n\n`;
        }
      );

      await ctx.reply(
        message,
        adminManagementMenu()
      );
    }
  );

  /*
   * Access management
   */
  bot.hears(
    "🔐 مدیریت سطح دسترسی",
    async (ctx) => {
      if (
        !(await requireSuperAdmin(ctx))
      ) {
        return;
      }

      clearState(ctx);

      await ctx.reply(
        "🔐 مدیریت سطح دسترسی",
        accessManagementMenu()
      );
    }
  );

  /*
   * Select admin
   */
  bot.hears(
    "👤 انتخاب ادمین",
    async (ctx) => {
      if (
        !(await requireSuperAdmin(ctx))
      ) {
        return;
      }

      startState(
        ctx,
        "access_select"
      );

      await ctx.reply(
        "👤 شناسه عددی ادمین را ارسال کنید.",
        cancelMenu()
      );
    }
  );

  /*
   * View access
   */
  bot.hears(
    "📋 مشاهده دسترسی‌ها",
    async (ctx) => {
      if (
        !(await requireSuperAdmin(ctx))
      ) {
        return;
      }

      startState(
        ctx,
        "access_select",
        {
          nextAction:
            "view_access",
        }
      );

      await ctx.reply(
        "👤 شناسه عددی ادمین را ارسال کنید تا دسترسی‌هایش نمایش داده شود.",
        cancelMenu()
      );
    }
  );

  /*
   * Change role
   */
  bot.hears(
    "🔄 تغییر سطح ادمین",
    async (ctx) => {
      if (
        !(await requireSuperAdmin(ctx))
      ) {
        return;
      }

      startState(
        ctx,
        "access_select",
        {
          nextAction:
            "change_role",
        }
      );

      await ctx.reply(
        "👤 شناسه عددی ادمین را ارسال کنید.",
        cancelMenu()
      );
    }
  );

  /*
   * Back to admin management
   */
  bot.hears(
    "🔙 مدیریت ادمین",
    async (ctx) => {
      if (
        !(await requireSuperAdmin(ctx))
      ) {
        return;
      }

      clearState(ctx);

      await ctx.reply(
        "🛠 مدیریت ادمین",
        adminManagementMenu()
      );
    }
  );

  /*
   * Enable admin
   */
  bot.hears(
    "🟢 فعال کردن ادمین",
    async (ctx) => {
      if (
        !(await requireSuperAdmin(ctx))
      ) {
        return;
      }

      startState(
        ctx,
        "enable_admin"
      );

      await ctx.reply(
        "👤 شناسه عددی ادمینی که باید فعال شود را ارسال کنید.",
        cancelMenu()
      );
    }
  );

  /*
   * Disable admin
   */
  bot.hears(
    "🔴 غیرفعال کردن ادمین",
    async (ctx) => {
      if (
        !(await requireSuperAdmin(ctx))
      ) {
        return;
      }

      startState(
        ctx,
        "disable_admin"
      );

      await ctx.reply(
        "👤 شناسه عددی ادمینی که باید غیرفعال شود را ارسال کنید.",
        cancelMenu()
      );
    }
  );

  /*
   * Remove admin
   */
  bot.hears(
    "🗑 حذف ادمین",
    async (ctx) => {
      if (
        !(await requireSuperAdmin(ctx))
      ) {
        return;
      }

      startState(
        ctx,
        "remove_admin"
      );

      await ctx.reply(
        "👤 شناسه عددی ادمینی که باید حذف شود را ارسال کنید.",
        cancelMenu()
      );
    }
  );

  /*
   * =========================
   * IMPORTANT:
   * Cancel must be caught BEFORE
   * generic text handlers.
   * =========================
   */
  bot.hears(
    CANCEL_TEXT,
    async (ctx) => {
      if (
        !(await requireSuperAdmin(ctx))
      ) {
        return;
      }

      const state =
        getState(ctx);

      clearState(ctx);

      if (
        state?.action ===
          "access_select" ||
        state?.action ===
          "role_select" ||
        state?.action ===
          "role_apply"
      ) {
        await ctx.reply(
          "❌ عملیات لغو شد.",
          accessManagementMenu()
        );

        return;
      }

      await ctx.reply(
        "❌ عملیات لغو شد.",
        adminManagementMenu()
      );
    }
  );

  /*
   * Generic text handler
   */
  bot.on(
    "text",
    handleAdminManagementText
  );
}

module.exports = {
  createAdminManagementHandler,
};
