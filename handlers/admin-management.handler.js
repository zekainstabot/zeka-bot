const { Markup } = require("telegraf");

const adminService = require("../services/admin-management.service");
const adminCoreService = require("../services/admin.service");

const {
  setUserCommands,
} = require("../services/command.service");

const {
  setSetting,
} = require("../services/settings.service");

const states = new Map();

const CANCEL_TEXT = "❌ لغو";

function adminManagementMenu() {
  return Markup.keyboard([
    ["➕ افزودن ادمین", "👥 لیست ادمین‌ها"],
    ["🔙 پنل Super Admin"],
  ])
    .resize()
    .oneTime(false);
}

function adminSettingsMenu() {
  return Markup.keyboard([
    ["📋 اطلاعات ادمین"],
    ["🔐 مدیریت دسترسی"],
    ["🔄 تغییر سطح ادمین"],
    ["🟢 فعال کردن", "🔴 غیرفعال کردن"],
    ["🐞 تنظیم ادمین گزارش"],
    ["🗑 حذف ادمین"],
    ["🔙 لیست ادمین‌ها"],
    ["🔙 مدیریت ادمین"],
  ])
    .resize()
    .oneTime(false);
}

function accessManagementMenu() {
  return Markup.keyboard([
    ["📋 مشاهده دسترسی‌ها"],
    ["➕ افزودن دسترسی", "➖ حذف دسترسی"],
    ["🔙 تنظیمات ادمین"],
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

function getAdminDisplayName(admin) {
  if (admin.display_name) {
    return admin.display_name;
  }

  if (admin.username) {
    return `@${admin.username}`;
  }

  return `کاربر ${admin.telegram_user_id}`;
}

function getRoleName(admin) {
  return (
    admin.role_name ||
    admin.role_key ||
    "نامشخص"
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

    default:
      return (
        error.message ||
        fallback
      );
  }
}

async function showAdminList(ctx) {
  try {
    const admins =
      await adminService.listAdmins();

    const selectableAdmins =
      admins.filter(
        (admin) =>
          admin.role_key !==
          "super_admin"
      );

    if (!selectableAdmins.length) {
      await ctx.reply(
        "📋 هیچ ادمین قابل مدیریتی وجود ندارد.",
        adminManagementMenu()
      );

      return;
    }

    const rows = [];
    const choices = {};

    selectableAdmins.forEach(
      (admin, index) => {
        const number =
          String(index + 1);

        const status =
          admin.is_active
            ? "🟢"
            : "🔴";

        const name =
          getAdminDisplayName(admin);

        const label =
          `${number}️⃣ ${status} ${name}`;

        choices[label] =
          Number(
            admin.telegram_user_id
          );

        rows.push([label]);
      }
    );

    rows.push([
      "🔙 مدیریت ادمین",
    ]);

    startState(
      ctx,
      "admin_select",
      {
        choices,
      }
    );

    await ctx.reply(
      "👥 لیست ادمین‌ها\n\n" +
        "ادمین موردنظر را انتخاب کنید:",
      Markup.keyboard(rows)
        .resize()
        .oneTime(false)
    );
  } catch (error) {
    console.error(
      "showAdminList error:",
      error
    );

    await ctx.reply(
      "❌ دریافت لیست ادمین‌ها انجام نشد.",
      adminManagementMenu()
    );
  }
}

async function showAdminSettings(
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
        adminManagementMenu()
      );

      return;
    }

    if (
      result.admin.role_key ===
      "super_admin"
    ) {
      await ctx.reply(
        "⛔ تنظیمات Super Admin از این بخش قابل تغییر نیست.",
        adminManagementMenu()
      );

      return;
    }

    startState(
      ctx,
      "admin_settings",
      {
        targetUserId:
          Number(telegramUserId),
      }
    );

    const status =
      result.admin.is_active
        ? "🟢 فعال"
        : "🔴 غیرفعال";

    const name =
      result.user.display_name ||
      (
        result.user.username
          ? `@${result.user.username}`
          : "بدون نام"
      );

    await ctx.reply(
      `⚙️ تنظیمات ادمین\n\n` +
        `👤 ${name}\n` +
        `🔐 سطح: ${
          result.admin.role_name ||
          result.admin.role_key
        }\n` +
        `📊 وضعیت: ${status}\n\n` +
        `یکی از گزینه‌های زیر را انتخاب کنید:`,
      adminSettingsMenu()
    );
  } catch (error) {
    console.error(
      "showAdminSettings error:",
      error
    );

    await ctx.reply(
      getErrorMessage(
        error,
        "❌ دریافت تنظیمات ادمین انجام نشد."
      ),
      adminManagementMenu()
    );
  }
}

async function showAdminInfo(
  ctx,
  telegramUserId
) {
  const result =
    await adminService.getAdminAccess(
      telegramUserId
    );

  const name =
    result.user.display_name ||
    "بدون نام";

  const username =
    result.user.username
      ? `@${result.user.username}`
      : "ندارد";

  const status =
    result.admin.is_active
      ? "🟢 فعال"
      : "🔴 غیرفعال";

  const directCount =
    result.directPermissions?.length ||
    0;

  const permissionCount =
    result.permissions?.length ||
    0;

  await ctx.reply(
    `📋 اطلاعات ادمین\n\n` +
      `👤 نام: ${name}\n` +
      `🔹 username: ${username}\n` +
      `🔐 سطح: ${
        result.admin.role_name ||
        result.admin.role_key
      }\n` +
      `📊 وضعیت: ${status}\n` +
      `🔑 تعداد دسترسی‌ها: ${permissionCount}\n` +
      `👤 دسترسی‌های اختصاصی: ${directCount}`,
    adminSettingsMenu()
  );
}

async function showAdminAccess(
  ctx,
  telegramUserId
) {
  try {
    const result =
      await adminService.getAdminAccess(
        telegramUserId
      );

    const permissions =
      result.permissions || [];

    const directPermissions =
      result.directPermissions || [];

    let message =
      "🔐 دسترسی‌های ادمین\n\n";

    if (!permissions.length) {
      message +=
        "❌ هیچ دسترسی فعالی ندارد.\n";
    } else {
      message +=
        "📋 دسترسی‌های نهایی:\n\n";

      permissions.forEach(
        (permission, index) => {
          const name =
            permission.permission_name ||
            permission.permission_key;

          const source =
            permission.source ===
            "direct"
              ? "👤 اختصاصی"
              : "🔐 از سطح ادمین";

          message +=
            `${index + 1}. ${name}\n` +
            `   ${source}\n\n`;
        }
      );
    }

    message +=
      "━━━━━━━━━━━━━━\n" +
      "👤 دسترسی‌های اختصاصی:\n\n";

    if (!directPermissions.length) {
      message +=
        "❌ ندارد.";
    } else {
      directPermissions.forEach(
        (permission, index) => {
          message +=
            `${index + 1}. ${
              permission.permission_name ||
              permission.permission_key
            }\n`;
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
        "❌ دریافت دسترسی‌ها انجام نشد."
      ),
      accessManagementMenu()
    );
  }
}

async function showPermissionList(
  ctx,
  mode
) {
  try {
    const permissions =
      await adminService.getAllPermissions();

    if (!permissions.length) {
      await ctx.reply(
        "❌ هیچ دسترسی‌ای ثبت نشده است.",
        accessManagementMenu()
      );

      return;
    }

    const rows = [];
    const choices = {};

    permissions.forEach(
      (permission) => {
        const label =
          `🔑 ${
            permission.permission_name ||
            permission.permission_key
          }`;

        choices[label] =
          permission.permission_key;

        rows.push([label]);
      }
    );

    rows.push([
      "🔙 تنظیمات ادمین",
    ]);

    startState(
      ctx,
      "permission_select",
      {
        targetUserId:
          getState(ctx)?.targetUserId,
        permissionMode: mode,
        choices,
      }
    );

    await ctx.reply(
      mode === "add"
        ? "➕ دسترسی موردنظر را انتخاب کنید:"
        : "➖ دسترسی موردنظر را انتخاب کنید:",
      Markup.keyboard(rows)
        .resize()
        .oneTime(false)
    );
  } catch (error) {
    console.error(
      "showPermissionList error:",
      error
    );

    await ctx.reply(
      getErrorMessage(
        error,
        "❌ دریافت دسترسی‌ها انجام نشد."
      ),
      accessManagementMenu()
    );
  }
}

async function showRoleList(ctx) {
  try {
    const roles =
      await adminService.getRoles();

    if (!roles.length) {
      await ctx.reply(
        "❌ هیچ سطح ادمینی وجود ندارد.",
        adminSettingsMenu()
      );

      return;
    }

    const rows = [];
    const choices = {};

    roles.forEach((role) => {
      const label =
        `🔐 ${
          role.role_name ||
          role.role_key
        }`;

      choices[label] =
        role.role_key;

      rows.push([label]);
    });

    rows.push([
      "🔙 تنظیمات ادمین",
    ]);

    const state =
      getState(ctx);

    startState(
      ctx,
      "role_select",
      {
        targetUserId:
          state?.targetUserId,
        choices,
      }
    );

    await ctx.reply(
      "🔄 سطح جدید ادمین را انتخاب کنید:",
      Markup.keyboard(rows)
        .resize()
        .oneTime(false)
    );
  } catch (error) {
    console.error(
      "showRoleList error:",
      error
    );

    await ctx.reply(
      getErrorMessage(
        error,
        "❌ دریافت سطوح ادمینی انجام نشد."
      ),
      adminSettingsMenu()
    );
  }
}

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
    state?.targetUserId
  ) {
    await showAdminSettings(
      ctx,
      state.targetUserId
    );

    return;
  }

  await ctx.reply(
    "❌ عملیات لغو شد.",
    adminManagementMenu()
  );
}

async function handleAdminManagementText(
  ctx,
  next
) {
  if (
    !(await requireSuperAdmin(ctx))
  ) {
    return;
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
   * انتخاب ادمین
   */

  if (
    state.action ===
    "admin_select"
  ) {
    if (
      text ===
      "🔙 مدیریت ادمین"
    ) {
      clearState(ctx);

      await ctx.reply(
        "🛠 مدیریت ادمین",
        adminManagementMenu()
      );

      return;
    }

    const targetId =
      state.choices?.[text];

    if (!targetId) {
      await ctx.reply(
        "❌ از دکمه‌های لیست استفاده کنید.",
        cancelMenu()
      );

      return;
    }

    clearState(ctx);

    await showAdminSettings(
      ctx,
      targetId
    );

    return;
  }

  /*
   * تنظیمات ادمین
   */

  if (
    state.action ===
    "admin_settings"
  ) {
    const targetId =
      state.targetUserId;

    if (!targetId) {
      clearState(ctx);

      await ctx.reply(
        "❌ ادمین انتخاب نشده است.",
        adminManagementMenu()
      );

      return;
    }

    if (
      text ===
      "📋 اطلاعات ادمین"
    ) {
      await showAdminInfo(
        ctx,
        targetId
      );

      return;
    }

    if (
      text ===
      "🔐 مدیریت دسترسی"
    ) {
      await ctx.reply(
        "🔐 مدیریت دسترسی",
        accessManagementMenu()
      );

      return;
    }

    if (
      text ===
      "🔄 تغییر سطح ادمین"
    ) {
      await showRoleList(ctx);
      return;
    }

    if (
      text ===
      "🟢 فعال کردن"
    ) {
      try {
        await adminService.setAdminActive(
          targetId,
          true
        );

        await ctx.reply(
          "🟢 ادمین فعال شد.",
          adminSettingsMenu()
        );
      } catch (error) {
        await ctx.reply(
          getErrorMessage(
            error,
            "❌ فعال‌سازی ادمین انجام نشد."
          ),
          adminSettingsMenu()
        );
      }

      return;
    }

    if (
      text ===
      "🔴 غیرفعال کردن"
    ) {
      try {
        await adminService.setAdminActive(
          targetId,
          false
        );

        await ctx.reply(
          "🔴 ادمین غیرفعال شد.",
          adminSettingsMenu()
        );
      } catch (error) {
        await ctx.reply(
          getErrorMessage(
            error,
            "❌ غیرفعال‌سازی ادمین انجام نشد."
          ),
          adminSettingsMenu()
        );
      }

      return;
    }

    if (
      text ===
      "🐞 تنظیم ادمین گزارش"
    ) {
      try {
        await setSetting(
          "support.report_admin_id",
          String(targetId)
        );

        await ctx.reply(
          "✅ این ادمین به‌عنوان ادمین گزارش تنظیم شد.",
          adminSettingsMenu()
        );
      } catch (error) {
        console.error(
          "set report admin error:",
          error
        );

        await ctx.reply(
          "❌ تنظیم ادمین گزارش انجام نشد.",
          adminSettingsMenu()
        );
      }

      return;
    }

    if (
      text ===
      "🗑 حذف ادمین"
    ) {
      try {
        await adminService.removeAdmin(
          targetId
        );

        clearState(ctx);

        await ctx.reply(
          "🗑 ادمین حذف شد.",
          adminManagementMenu()
        );
      } catch (error) {
        await ctx.reply(
          getErrorMessage(
            error,
            "❌ حذف ادمین انجام نشد."
          ),
          adminSettingsMenu()
        );
      }

      return;
    }

    if (
      text ===
      "🔙 لیست ادمین‌ها"
    ) {
      await showAdminList(ctx);
      return;
    }

    if (
      text ===
      "🔙 مدیریت ادمین"
    ) {
      clearState(ctx);

      await ctx.reply(
        "🛠 مدیریت ادمین",
        adminManagementMenu()
      );

      return;
    }

    return;
  }

  /*
   * مدیریت دسترسی
   */

  if (
    state.action ===
    "permission_menu"
  ) {
    if (
      text ===
      "📋 مشاهده دسترسی‌ها"
    ) {
      await showAdminAccess(
        ctx,
        state.targetUserId
      );

      return;
    }

    if (
      text ===
      "➕ افزودن دسترسی"
    ) {
      await showPermissionList(
        ctx,
        "add"
      );

      return;
    }

    if (
      text ===
      "➖ حذف دسترسی"
    ) {
      await showPermissionList(
        ctx,
        "remove"
      );

      return;
    }

    if (
      text ===
      "🔙 تنظیمات ادمین"
    ) {
      await showAdminSettings(
        ctx,
        state.targetUserId
      );

      return;
    }

    return;
  }

  /*
   * انتخاب Permission
   */

  if (
    state.action ===
    "permission_select"
  ) {
    if (
      text ===
      "🔙 تنظیمات ادمین"
    ) {
      await showAdminSettings(
        ctx,
        state.targetUserId
      );

      return;
    }

    const permissionKey =
      state.choices?.[text];

    if (!permissionKey) {
      await ctx.reply(
        "❌ از دکمه‌های لیست استفاده کنید.",
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
          permissionKey
        );

        await ctx.reply(
          "✅ دسترسی به ادمین اضافه شد.",
          accessManagementMenu()
        );
      } else {
        await adminService.removePermission(
          state.targetUserId,
          permissionKey
        );

        await ctx.reply(
          "✅ دسترسی اختصاصی ادمین حذف شد.",
          accessManagementMenu()
        );
      }

      startState(
        ctx,
        "permission_menu",
        {
          targetUserId:
            state.targetUserId,
        }
      );
    } catch (error) {
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
   * انتخاب Role
   */

  if (
    state.action ===
    "role_select"
  ) {
    if (
      text ===
      "🔙 تنظیمات ادمین"
    ) {
      await showAdminSettings(
        ctx,
        state.targetUserId
      );

      return;
    }

    const roleKey =
      state.choices?.[text];

    if (!roleKey) {
      await ctx.reply(
        "❌ از دکمه‌های لیست استفاده کنید.",
        cancelMenu()
      );

      return;
    }

    try {
      await adminService.changeAdminRole(
        state.targetUserId,
        roleKey
      );

      await updateUserCommands(
        ctx,
        state.targetUserId,
        roleKey
      );

      await ctx.reply(
        "✅ سطح ادمین با موفقیت تغییر کرد.",
        adminSettingsMenu()
      );

      startState(
        ctx,
        "admin_settings",
        {
          targetUserId:
            state.targetUserId,
        }
      );
    } catch (error) {
      await ctx.reply(
        getErrorMessage(
          error,
          "❌ تغییر سطح ادمین انجام نشد."
        ),
        adminSettingsMenu()
      );
    }

    return;
  }

  /*
   * افزودن ادمین
   */

  if (
    state.action ===
    "add_admin"
  ) {
    if (!/^\d+$/.test(text)) {
      await ctx.reply(
        "❌ برای افزودن ادمین جدید، شناسه عددی تلگرام را ارسال کنید.",
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

  return next();
}

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
        "👤 برای افزودن ادمین جدید، شناسه عددی تلگرام او را ارسال کنید.",
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

      await showAdminList(ctx);
    }
  );

  bot.hears(
    "🔐 مدیریت دسترسی",
    async (ctx) => {
      if (
        !(await requireSuperAdmin(ctx))
      ) {
        return;
      }

      const state =
        getState(ctx);

      if (
        !state?.targetUserId
      ) {
        await ctx.reply(
          "❌ ابتدا یک ادمین را انتخاب کنید.",
          adminManagementMenu()
        );

        return;
      }

      startState(
        ctx,
        "permission_menu",
        {
          targetUserId:
            state.targetUserId,
        }
      );

      await ctx.reply(
        "🔐 مدیریت دسترسی",
        accessManagementMenu()
      );
    }
  );

  bot.hears(
    "📋 مشاهده دسترسی‌ها",
    async (ctx) => {
      const state =
        getState(ctx);

      if (
        !state?.targetUserId
      ) {
        return;
      }

      await showAdminAccess(
        ctx,
        state.targetUserId
      );
    }
  );

  bot.hears(
    "➕ افزودن دسترسی",
    async (ctx) => {
      const state =
        getState(ctx);

      if (
        !state?.targetUserId
      ) {
        return;
      }

      await showPermissionList(
        ctx,
        "add"
      );
    }
  );

  bot.hears(
    "➖ حذف دسترسی",
    async (ctx) => {
      const state =
        getState(ctx);

      if (
        !state?.targetUserId
      ) {
        return;
      }

      await showPermissionList(
        ctx,
        "remove"
      );
    }
  );

  bot.hears(
    "📋 اطلاعات ادمین",
    async (ctx) => {
      const state =
        getState(ctx);

      if (
        !state?.targetUserId
      ) {
        return;
      }

      await showAdminInfo(
        ctx,
        state.targetUserId
      );
    }
  );

  bot.hears(
    "🔄 تغییر سطح ادمین",
    async (ctx) => {
      const state =
        getState(ctx);

      if (
        !state?.targetUserId
      ) {
        return;
      }

      await showRoleList(ctx);
    }
  );

  bot.hears(
    "🟢 فعال کردن",
    async (ctx) => {
      const state =
        getState(ctx);

      if (
        !state?.targetUserId
      ) {
        return;
      }

      try {
        await adminService.setAdminActive(
          state.targetUserId,
          true
        );

        await ctx.reply(
          "🟢 ادمین فعال شد.",
          adminSettingsMenu()
        );
      } catch (error) {
        await ctx.reply(
          getErrorMessage(
            error,
            "❌ فعال‌سازی انجام نشد."
          ),
          adminSettingsMenu()
        );
      }
    }
  );

  bot.hears(
    "🔴 غیرفعال کردن",
    async (ctx) => {
      const state =
        getState(ctx);

      if (
        !state?.targetUserId
      ) {
        return;
      }

      try {
        await adminService.setAdminActive(
          state.targetUserId,
          false
        );

        await ctx.reply(
          "🔴 ادمین غیرفعال شد.",
          adminSettingsMenu()
        );
      } catch (error) {
        await ctx.reply(
          getErrorMessage(
            error,
            "❌ غیرفعال‌سازی انجام نشد."
          ),
          adminSettingsMenu()
        );
      }
    }
  );

  bot.hears(
    "🐞 تنظیم ادمین گزارش",
    async (ctx) => {
      const state =
        getState(ctx);

      if (
        !state?.targetUserId
      ) {
        return;
      }

      try {
        await setSetting(
          "support.report_admin_id",
          String(
            state.targetUserId
          )
        );

        await ctx.reply(
          "✅ این ادمین به‌عنوان ادمین گزارش تنظیم شد.",
          adminSettingsMenu()
        );
      } catch (error) {
        console.error(
          "set report admin error:",
          error
        );

        await ctx.reply(
          "❌ تنظیم ادمین گزارش انجام نشد.",
          adminSettingsMenu()
        );
      }
    }
  );

  bot.hears(
    "🗑 حذف ادمین",
    async (ctx) => {
      const state =
        getState(ctx);

      if (
        !state?.targetUserId
      ) {
        return;
      }

      try {
        await adminService.removeAdmin(
          state.targetUserId
        );

        clearState(ctx);

        await ctx.reply(
          "🗑 ادمین حذف شد.",
          adminManagementMenu()
        );
      } catch (error) {
        await ctx.reply(
          getErrorMessage(
            error,
            "❌ حذف ادمین انجام نشد."
          ),
          adminSettingsMenu()
        );
      }
    }
  );

  bot.hears(
    "🔙 لیست ادمین‌ها",
    async (ctx) => {
      await showAdminList(ctx);
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
    "❌ لغو",
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
