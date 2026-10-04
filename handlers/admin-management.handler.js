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
    ["➕ افزودن دسترسی", "➖ حذف دسترسی"],
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

function stateKey(ctx) {
  return String(ctx.from.id);
}

function startState(
  ctx,
  action,
  extra = {}
) {
  states.set(
    stateKey(ctx),
    {
      action,
      createdAt: Date.now(),
      ...extra,
    }
  );
}

function getState(ctx) {
  return states.get(
    stateKey(ctx)
  );
}

function clearState(ctx) {
  states.delete(
    stateKey(ctx)
  );
}

function isExpired(state) {
  if (!state?.createdAt) {
    return true;
  }

  return (
    Date.now() -
      state.createdAt >
    10 * 60 * 1000
  );
}

async function updateUserCommands(
  ctx,
  targetTelegramUserId,
  roleKey
) {
  try {
    await setUserCommands(
      ctx.telegram,
      Number(targetTelegramUserId),
      roleKey
    );
  } catch (error) {
    console.error(
      "updateUserCommands error:",
      error
    );
  }
}

function getErrorMessage(
  error,
  fallback
) {
  if (!error) {
    return fallback;
  }

  switch (error.code) {
    case "USER_NOT_FOUND":
      return "❌ کاربر موردنظر در ربات پیدا نشد.";

    case "ADMIN_NOT_FOUND":
      return "❌ این کاربر ادمین نیست.";

    case "ALREADY_ADMIN":
      return "⚠️ این کاربر از قبل ادمین است.";

    case "SUPER_ADMIN_PROTECTED":
      return "⛔ امکان تغییر یا حذف Super Admin وجود ندارد.";

    case "INVALID_ROLE":
      return "❌ سطح ادمینی نامعتبر است.";

    case "ROLE_UPDATE_FAILED":
      return "❌ تغییر سطح ادمین انجام نشد.";

    case "PERMISSION_NOT_FOUND":
      return "❌ این دسترسی وجود ندارد.";

    case "PERMISSION_DENIED":
      return "⛔ این عملیات برای شما مجاز نیست.";

    case "USER_ID_REQUIRED":
      return "❌ شناسه کاربر وارد نشده است.";

    default:
      return (
        error.message ||
        fallback
      );
  }
}

/*
 * =========================
 * Access Display
 * =========================
 */

async function showAdminAccess(
  ctx,
  telegramUserId
) {
  try {
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

    const role =
      result.admin?.role_name ||
      result.admin?.role_key ||
      "نامشخص";

    const permissions =
      result.permissions || [];

    const directPermissions =
      result.directPermissions || [];

    let message =
      `👤 ادمین: ${telegramUserId}\n` +
      `🔐 سطح: ${role}\n\n`;

    message +=
      "📋 دسترسی‌های نهایی:\n\n";

    if (!permissions.length) {
      message +=
        "❌ هیچ دسترسی فعالی ندارد.\n";
    } else {
      permissions.forEach(
        (permission, index) => {
          const name =
            permission.permission_name ||
            permission.permission_key ||
            "نامشخص";

          const source =
            permission.source ===
            "direct"
              ? "👤 اختصاصی"
              : "🔐 سطح ادمین";

          message +=
            `${index + 1}. ${name}\n` +
            `   ${source}\n\n`;
        }
      );
    }

    message +=
      "━━━━━━━━━━━━━━\n" +
      "👤 دسترسی‌های اختصاصی این ادمین:\n\n";

    if (!directPermissions.length) {
      message +=
        "❌ هیچ دسترسی اختصاصی ثبت نشده است.";
    } else {
      directPermissions.forEach(
        (permission, index) => {
          const name =
            permission.permission_name ||
            permission.permission_key ||
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
  } catch (error) {
    console.error(
      "showAdminAccess error:",
      error
    );

    await ctx.reply(
      getErrorMessage(
        error,
        "❌ دریافت دسترسی‌های ادمین انجام نشد."
      ),
      accessManagementMenu()
    );
  }
}

/*
 * =========================
 * Permission List
 * =========================
 */

async function showPermissionList(
  ctx,
  mode
) {
  try {
    const permissions =
      await adminService.getAllPermissions();

    if (!permissions?.length) {
      clearState(ctx);

      await ctx.reply(
        "❌ هیچ دسترسی‌ای در سیستم ثبت نشده است.",
        accessManagementMenu()
      );

      return;
    }

    const title =
      mode === "add"
        ? "➕ افزودن دسترسی"
        : "➖ حذف دسترسی";

    let message =
      `${title}\n\n`;

    permissions.forEach(
      (permission, index) => {
        message +=
          `${index + 1}. ` +
          `${permission.permission_name || permission.permission_key}\n` +
          `   🔑 ${permission.permission_key}\n\n`;
      }
    );

    message +=
      "🔹 کلید دسترسی موردنظر را ارسال کنید.";

    await ctx.reply(
      message,
      cancelMenu()
    );
  } catch (error) {
    console.error(
      "showPermissionList error:",
      error
    );

    clearState(ctx);

    await ctx.reply(
      getErrorMessage(
        error,
        "❌ دریافت لیست دسترسی‌ها انجام نشد."
      ),
      accessManagementMenu()
    );
  }
}

/*
 * =========================
 * Cancel
 * =========================
 */

async function handleCancel(ctx) {
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
      "role_apply" ||
    state?.action ===
      "permission_select" ||
    state?.action ===
      "permission_apply"
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

/*
 * =========================
 * State Text Handler
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

  const text =
    ctx.message?.text?.trim();

  if (!text) {
    return next();
  }

  if (
    text === CANCEL_TEXT ||
    text === "/cancel"
  ) {
    await handleCancel(ctx);
    return;
  }

  if (isExpired(state)) {
    clearState(ctx);

    await ctx.reply(
      "⌛ زمان این عملیات تمام شده است.",
      adminManagementMenu()
    );

    return;
  }

  /*
   * =========================
   * Select Admin
   * =========================
   */

  if (
    state.action ===
    "access_select"
  ) {
    if (!/^\d+$/.test(text)) {
      await ctx.reply(
        "❌ شناسه تلگرام معتبر نیست.\n\nمثال:\n123456789",
        cancelMenu()
      );

      return;
    }

    const targetId =
      Number(text);

    state.targetUserId =
      targetId;

    if (
      state.nextAction ===
      "view_access"
    ) {
      clearState(ctx);

      await showAdminAccess(
        ctx,
        targetId
      );

      return;
    }

    if (
      state.nextAction ===
      "change_role"
    ) {
      try {
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

        state.action =
          "role_select";

        states.set(
          stateKey(ctx),
          state
        );

        let message =
          "🔄 سطح جدید را انتخاب کنید:\n\n";

        roles.forEach(
          (role, index) => {
            message +=
              `${index + 1}. ` +
              `${role.role_name || role.role_key}\n` +
              `   🔑 ${role.role_key}\n\n`;
          }
        );

        message +=
          "🔹 کلید سطح موردنظر را ارسال کنید.";

        await ctx.reply(
          message,
          cancelMenu()
        );
      } catch (error) {
        console.error(
          "getRoles error:",
          error
        );

        clearState(ctx);

        await ctx.reply(
          getErrorMessage(
            error,
            "❌ دریافت سطوح ادمینی انجام نشد."
          ),
          accessManagementMenu()
        );
      }

      return;
    }

    if (
      state.nextAction ===
      "add_permission"
    ) {
      state.action =
        "permission_select";

      state.permissionMode =
        "add";

      states.set(
        stateKey(ctx),
        state
      );

      await showPermissionList(
        ctx,
        "add"
      );

      return;
    }

    if (
      state.nextAction ===
      "remove_permission"
    ) {
      state.action =
        "permission_select";

      state.permissionMode =
        "remove";

      states.set(
        stateKey(ctx),
        state
      );

      await showPermissionList(
        ctx,
        "remove"
      );

      return;
    }

    return;
  }

  /*
   * =========================
   * Permission Select
   * =========================
   */

  if (
    state.action ===
    "permission_select"
  ) {
    const permissions =
      await adminService.getAllPermissions();

    const permission =
      permissions.find(
        (item) =>
          item.permission_key ===
            text ||
          item.permission_name ===
            text
      );

    if (!permission) {
      await ctx.reply(
        "❌ کلید دسترسی صحیح نیست.\n\nلطفاً یکی از کلیدهای نمایش داده‌شده را ارسال کنید.",
        cancelMenu()
      );

      return;
    }

    state.action =
      "permission_apply";

    state.permissionKey =
      permission.permission_key;

    states.set(
      stateKey(ctx),
      state
    );

    const actionText =
      state.permissionMode ===
      "add"
        ? "➕ افزودن"
        : "➖ حذف";

    await ctx.reply(
      `⚠️ تأیید عملیات\n\n` +
        `👤 ادمین: ${state.targetUserId}\n` +
        `🔑 دسترسی: ${permission.permission_name || permission.permission_key}\n` +
        `⚙️ عملیات: ${actionText}\n\n` +
        `برای تأیید، کلید زیر را ارسال کنید:\n\n` +
        `${permission.permission_key}`,
      cancelMenu()
    );

    return;
  }

  /*
   * =========================
   * Permission Apply
   * =========================
   */

  if (
    state.action ===
    "permission_apply"
  ) {
    if (
      text !==
      state.permissionKey
    ) {
      await ctx.reply(
        `❌ مقدار صحیح را ارسال کنید:\n\n${state.permissionKey}`,
        cancelMenu()
      );

      return;
    }

    try {
      if (
        state.permissionMode ===
        "add"
      ) {
        await adminService.addPermission(
          state.targetUserId,
          state.permissionKey
        );

        clearState(ctx);

        await ctx.reply(
          "✅ دسترسی با موفقیت به ادمین اضافه شد.",
          accessManagementMenu()
        );

        return;
      }

      await adminService.removePermission(
        state.targetUserId,
        state.permissionKey
      );

      clearState(ctx);

      await ctx.reply(
        "✅ دسترسی اختصاصی ادمین حذف شد.",
        accessManagementMenu()
      );
    } catch (error) {
      console.error(
        "permission operation error:",
        error
      );

      clearState(ctx);

      await ctx.reply(
        getErrorMessage(
          error,
          "❌ عملیات دسترسی انجام نشد."
        ),
        accessManagementMenu()
      );
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
    try {
      const roles =
        await adminService.getRoles();

      const role =
        roles.find(
          (item) =>
            item.role_key ===
              text ||
            item.role_name ===
              text
        );

      if (!role) {
        await ctx.reply(
          "❌ این سطح ادمینی پیدا نشد.\n\nکلید صحیح سطح را ارسال کنید.",
          cancelMenu()
        );

        return;
      }

      state.action =
        "role_apply";

      state.roleKey =
        role.role_key;

      states.set(
        stateKey(ctx),
        state
      );

      await ctx.reply(
        `⚠️ تغییر سطح ادمین\n\n` +
          `👤 ادمین: ${state.targetUserId}\n` +
          `🔐 سطح جدید: ${
            role.role_name ||
            role.role_key
          }\n\n` +
          `برای تأیید، کلید زیر را ارسال کنید:\n\n` +
          `${role.role_key}`,
        cancelMenu()
      );
    } catch (error) {
      console.error(
        "role_select error:",
        error
      );

      await ctx.reply(
        getErrorMessage(
          error,
          "❌ دریافت سطح ادمینی انجام نشد."
        ),
        cancelMenu()
      );
    }

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

    try {
      await adminService.changeAdminRole(
        state.targetUserId,
        state.roleKey
      );

      clearState(ctx);

      await updateUserCommands(
        ctx,
        state.targetUserId,
        state.roleKey
      );

      await ctx.reply(
        "✅ سطح دسترسی ادمین با موفقیت تغییر کرد.",
        accessManagementMenu()
      );
    } catch (error) {
      console.error(
        "changeAdminRole error:",
        error
      );

      clearState(ctx);

      await ctx.reply(
        getErrorMessage(
          error,
          "❌ تغییر سطح ادمین انجام نشد."
        ),
        accessManagementMenu()
      );
    }

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
        "❌ شناسه تلگرام معتبر نیست.\n\nمثال:\n123456789",
        cancelMenu()
      );

      return;
    }

    try {
      await adminService.addAdmin(
        Number(text)
      );

      clearState(ctx);

      await ctx.reply(
        "✅ ادمین با موفقیت اضافه شد.",
        adminManagementMenu()
      );
    } catch (error) {
      console.error(
        "addAdmin error:",
        error
      );

      clearState(ctx);

      await ctx.reply(
        getErrorMessage(
          error,
          "❌ افزودن ادمین انجام نشد."
        ),
        adminManagementMenu()
      );
    }

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

    try {
      await adminService.setAdminActive(
        Number(text),
        true
      );

      clearState(ctx);

      await ctx.reply(
        "🟢 ادمین فعال شد.",
        adminManagementMenu()
      );
    } catch (error) {
      console.error(
        "enable admin error:",
        error
      );

      clearState(ctx);

      await ctx.reply(
        getErrorMessage(
          error,
          "❌ فعال‌سازی ادمین انجام نشد."
        ),
        adminManagementMenu()
      );
    }

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

    try {
      await adminService.setAdminActive(
        Number(text),
        false
      );

      clearState(ctx);

      await ctx.reply(
        "🔴 ادمین غیرفعال شد.",
        adminManagementMenu()
      );
    } catch (error) {
      console.error(
        "disable admin error:",
        error
      );

      clearState(ctx);

      await ctx.reply(
        getErrorMessage(
          error,
          "❌ غیرفعال‌سازی ادمین انجام نشد."
        ),
        adminManagementMenu()
      );
    }

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

    try {
      await adminService.removeAdmin(
        Number(text)
      );

      clearState(ctx);

      await ctx.reply(
        "🗑 ادمین حذف شد.",
        adminManagementMenu()
      );
    } catch (error) {
      console.error(
        "removeAdmin error:",
        error
      );

      clearState(ctx);

      await ctx.reply(
        getErrorMessage(
          error,
          "❌ حذف ادمین انجام نشد."
        ),
        adminManagementMenu()
      );
    }

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

  bot.hears(
    "👥 لیست ادمین‌ها",
    async (ctx) => {
      if (
        !(await requireSuperAdmin(ctx))
      ) {
        return;
      }

      clearState(ctx);

      try {
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
              admin.role_name ||
              admin.role_key ||
              "admin";

            message +=
              `${index + 1}. ${admin.telegram_user_id}\n` +
              `   🔐 ${role}\n` +
              `   ${status}\n\n`;
          }
        );

        await ctx.reply(
          message,
          adminManagementMenu()
        );
      } catch (error) {
        console.error(
          "listAdmins error:",
          error
        );

        await ctx.reply(
          "❌ دریافت لیست ادمین‌ها انجام نشد.",
          adminManagementMenu()
        );
      }
    }
  );

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

  bot.hears(
    "➕ افزودن دسترسی",
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
            "add_permission",
        }
      );

      await ctx.reply(
        "👤 شناسه عددی ادمین را ارسال کنید.",
        cancelMenu()
      );
    }
  );

  bot.hears(
    "➖ حذف دسترسی",
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
            "remove_permission",
        }
      );

      await ctx.reply(
        "👤 شناسه عددی ادمین را ارسال کنید.",
        cancelMenu()
      );
    }
  );

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

  bot.hears(
    CANCEL_TEXT,
    async (ctx) => {
      await handleCancel(ctx);
    }
  );

  bot.on(
    "text",
    handleAdminManagementText
  );
}

module.exports = {
  createAdminManagementHandler,
};
