const {
  Markup,
} = require("telegraf");

const adminManagementService = require(
  "../services/admin-management.service"
);

const adminManagementStates = new Map();

const CANCEL_TEXT = "❌ لغو";

/*
 * Permission جدید مدیریت ادمین
 *
 * همه Permission های قدیمی در Repository
 * به این کلیدها تبدیل می‌شوند.
 */
const PERMISSION_VIEW = "admins";
const PERMISSION_MANAGE = "admins";

/*
 * ترتیب و نام نمایشی Permission ها
 */
const PERMISSION_ORDER = [
  {
    key: "users",
    name: "کاربران",
  },
  {
    key: "settings",
    name: "تنظیمات",
  },
  {
    key: "requests",
    name: "درخواست‌ها",
  },
  {
    key: "credits",
    name: "اعتبارها",
  },
  {
    key: "rewards",
    name: "پاداش‌ها",
  },
  {
    key: "platforms",
    name: "پلتفرم‌ها",
  },
  {
    key: "features",
    name: "قابلیت‌ها",
  },
  {
    key: "support",
    name: "پشتیبانی",
  },
  {
    key: "monitoring",
    name: "مانیتورینگ",
  },
  {
    key: "admins",
    name: "مدیران",
  },
  {
    key: "reports",
    name: "گزارش‌ها",
  },
  {
  key: "bug_reports",
  name: "گزارش مشکل",
},
  {
    key: "games.quiz",
    name: "مسابقه",
  },
  {
    key: "pro",
    name: "Pro",
  },
];

function getState(telegramUserId) {
  return (
    adminManagementStates.get(
      String(telegramUserId)
    ) || null
  );
}

function setState(
  telegramUserId,
  state
) {
  adminManagementStates.set(
    String(telegramUserId),
    state
  );
}

function clearState(
  telegramUserId
) {
  adminManagementStates.delete(
    String(telegramUserId)
  );
}

function managementMenu() {
  return Markup.keyboard([
    ["➕ افزودن ادمین", "👥 لیست ادمین‌ها"],
    ["🔙 پنل Super Admin"],
  ]).resize();
}

function adminSettingsMenu() {
  return Markup.keyboard([
    ["📋 اطلاعات ادمین"],
    ["🔐 مدیریت دسترسی"],
    ["🔄 تغییر سطح ادمین"],
    ["🟢 فعال کردن", "🔴 غیرفعال کردن"],
    ["🗑 حذف ادمین"],
    ["🔙 لیست ادمین‌ها"],
    ["🔙 مدیریت ادمین"],
  ]).resize();
}

function accessManagementMenu() {
  return Markup.keyboard([
    ["🔄 بازنشانی همه"],
    ["🔙 تنظیمات ادمین"],
  ]).resize();
}

function cancelMenu() {
  return Markup.keyboard([
    [CANCEL_TEXT],
  ]).resize();
}

function getAdminDisplayName(
  admin,
  index
) {
  if (admin.display_name) {
    return admin.display_name;
  }

  if (admin.username) {
    return `@${admin.username}`;
  }

  return `ادمین ${index + 1}`;
}

/*
 * وضعیت Override:
 *
 * true  -> 🟢
 * false -> 🔴
 * null  -> ⚪
 */
function getPermissionStatusIcon(
  permission
) {
  if (
    permission.override_enabled ===
    true
  ) {
    return "🟢";
  }

  if (
    permission.override_enabled ===
    false
  ) {
    return "🔴";
  }

  return "⚪";
}

function getPermissionStatusText(
  permission
) {
  if (
    permission.override_enabled ===
    true
  ) {
    return "فعال";
  }

  if (
    permission.override_enabled ===
    false
  ) {
    return "غیرفعال";
  }

  return "پیش‌فرض";
}

/*
 * فقط Permission های جدید و مجاز
 * نمایش داده می‌شوند.
 */
function normalizePermissionList(
  permissions
) {
  const map = new Map();

  for (const permission of permissions || []) {
    if (!permission?.permission_key) {
      continue;
    }

    map.set(
      permission.permission_key,
      permission
    );
  }

  return PERMISSION_ORDER
    .map((definition) => {
      const existing =
        map.get(definition.key);

      if (!existing) {
        return null;
      }

      return {
        ...existing,
        permission_name:
          definition.name,
      };
    })
    .filter(Boolean);
}

function buildPermissionToggleMenu(
  permissions
) {
  const buttons = [];

  permissions.forEach(
    (permission, index) => {
      buttons.push([
        `${getPermissionStatusIcon(
          permission
        )} ${index + 1}️⃣ ${
          permission.permission_name
        }`,
      ]);
    }
  );

  buttons.push([
    "🔄 بازنشانی همه",
  ]);

  buttons.push([
    "🔙 تنظیمات ادمین",
  ]);

  return Markup.keyboard(
    buttons
  ).resize();
}

async function requirePermission(
  ctx,
  permissionKey
) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return false;
  }

  try {
    await adminManagementService.requirePermissionByTelegramId(
      telegramUserId,
      permissionKey
    );

    return true;
  } catch (error) {
    if (
      error.code ===
      "PERMISSION_DENIED"
    ) {
      await ctx.reply(
        "⛔ شما دسترسی لازم برای این بخش را ندارید."
      );

      return false;
    }

    if (
      error.code ===
      "ADMIN_ACCESS_DENIED"
    ) {
      await ctx.reply(
        "⛔ حساب مدیریتی شما فعال نیست."
      );

      return false;
    }

    console.error(
      "Admin management permission check failed:",
      error
    );

    await ctx.reply(
      "❌ بررسی دسترسی انجام نشد."
    );

    return false;
  }
}

async function requireView(ctx) {
  return requirePermission(
    ctx,
    PERMISSION_VIEW
  );
}

async function requireManage(ctx) {
  return requirePermission(
    ctx,
    PERMISSION_MANAGE
  );
}

async function showAdminManagementMenu(
  ctx
) {
  if (!(await requireView(ctx))) {
    return;
  }

  clearState(ctx.from.id);

  await ctx.reply(
    "🛠 مدیریت ادمین\n\n" +
      "عملیات موردنظر را انتخاب کنید.",
    managementMenu()
  );
}

async function showAdminList(ctx) {
  if (!(await requireView(ctx))) {
    return;
  }

  try {
    const admins =
      await adminManagementService.listAdmins();

    const visibleAdmins =
      admins.filter(
        (admin) =>
          admin.role_key !==
          "super_admin"
      );

    if (!visibleAdmins.length) {
      await ctx.reply(
        "👥 هیچ ادمین معمولی‌ای وجود ندارد.",
        managementMenu()
      );

      return;
    }

    setState(
      ctx.from.id,
      {
        step: "selectAdmin",
        choices:
          visibleAdmins.map(
            (admin) =>
              admin.telegram_user_id
          ),
      }
    );

    let text =
      "👥 لیست ادمین‌ها\n\n";

    visibleAdmins.forEach(
      (admin, index) => {
        text +=
          `${index + 1}️⃣ ${getAdminDisplayName(
            admin,
            index
          )}\n`;

        text +=
          `   نقش: ${admin.role_name}\n`;

        text +=
          `   وضعیت: ${
            admin.is_active
              ? "🟢 فعال"
              : "🔴 غیرفعال"
          }\n\n`;
      }
    );

    await ctx.reply(
      text +
        "ادمین موردنظر را انتخاب کنید:",
      buildAdminList(
        visibleAdmins
      )
    );
  } catch (error) {
    console.error(
      "Admin list failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت لیست ادمین‌ها انجام نشد.",
      managementMenu()
    );
  }
}

function buildAdminList(admins) {
  const buttons = [];

  admins.forEach(
    (admin, index) => {
      buttons.push([
        `${index + 1}️⃣ ${getAdminDisplayName(
          admin,
          index
        )}`,
      ]);
    }
  );

  buttons.push([
    "🔙 مدیریت ادمین",
  ]);

  return Markup.keyboard(
    buttons
  ).resize();
}

async function showAdminSettings(
  ctx,
  targetTelegramUserId
) {
  if (!(await requireView(ctx))) {
    return;
  }

  try {
    const access =
      await adminManagementService.getAdminAccess(
        targetTelegramUserId
      );

    if (!access?.admin) {
      await ctx.reply(
        "❌ ادمین پیدا نشد.",
        managementMenu()
      );

      return;
    }

    if (
      access.admin.role_key ===
      "super_admin"
    ) {
      await ctx.reply(
        "⛔ مدیریت Super Admin از این بخش مجاز نیست.",
        managementMenu()
      );

      return;
    }

    setState(
      ctx.from.id,
      {
        step: "adminSettings",
        targetUserId:
          targetTelegramUserId,
      }
    );

    const admin =
      access.admin;

    await ctx.reply(
      "⚙️ تنظیمات ادمین\n\n" +
        `👤 ${
          admin.display_name ||
          (admin.username
            ? "@" + admin.username
            : "ادمین")
        }\n` +
        `🎭 نقش: ${admin.role_name}\n` +
        `📌 وضعیت: ${
          admin.is_active
            ? "🟢 فعال"
            : "🔴 غیرفعال"
        }\n\n` +
        "بخش موردنظر را انتخاب کنید:",
      adminSettingsMenu()
    );
  } catch (error) {
    console.error(
      "Admin settings failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت تنظیمات ادمین انجام نشد.",
      managementMenu()
    );
  }
}

async function showAdminInfo(
  ctx,
  targetTelegramUserId
) {
  if (!(await requireView(ctx))) {
    return;
  }

  try {
    const access =
      await adminManagementService.getAdminAccess(
        targetTelegramUserId
      );

    if (!access?.admin) {
      await ctx.reply(
        "❌ ادمین پیدا نشد."
      );

      return;
    }

    const admin =
      access.admin;

    const user =
      access.user || {};

    const username =
      admin.username ||
      user.username;

    await ctx.reply(
      "📋 اطلاعات ادمین\n\n" +
        `👤 نام: ${
          admin.display_name ||
          user.display_name ||
          "ثبت نشده"
        }\n` +
        `🔹 Username: ${
          username
            ? "@" + username
            : "ثبت نشده"
        }\n` +
        `🎭 نقش: ${
          admin.role_name ||
          "ثبت نشده"
        }\n` +
        `📌 وضعیت: ${
          admin.is_active
            ? "🟢 فعال"
            : "🔴 غیرفعال"
        }\n` +
        `🕐 آخرین ورود: ${
          admin.last_login_at ||
          "ثبت نشده"
        }\n` +
        `📅 ایجاد: ${
          admin.created_at ||
          "نامشخص"
        }`,
      adminSettingsMenu()
    );
  } catch (error) {
    console.error(
      "Admin info failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت اطلاعات ادمین انجام نشد."
    );
  }
}

async function showAccessManagement(
  ctx,
  targetTelegramUserId
) {
  if (!(await requireView(ctx))) {
    return;
  }

  try {
    const access =
      await adminManagementService.getPermissionMatrix(
        targetTelegramUserId
      );

    if (!access?.admin) {
      await ctx.reply(
        "❌ ادمین پیدا نشد.",
        managementMenu()
      );

      return;
    }

    if (
      access.admin.role_key ===
      "super_admin"
    ) {
      clearState(ctx.from.id);

      await ctx.reply(
        "⛔ دسترسی‌های Super Admin قابل ویرایش نیست.",
        managementMenu()
      );

      return;
    }

    const permissions =
      normalizePermissionList(
        access.permissions
      );

    setState(
      ctx.from.id,
      {
        step: "permissionToggle",
        targetUserId:
          targetTelegramUserId,
        choices:
          permissions.map(
            (permission) =>
              permission.permission_key
          ),
      }
    );

    if (!permissions.length) {
      await ctx.reply(
        "🔐 مدیریت دسترسی\n\n" +
          "❌ هیچ Permissionای در سیستم ثبت نشده است.",
        accessManagementMenu()
      );

      return;
    }

    const admin =
      access.admin;

    let text =
      "🔐 مدیریت دسترسی\n\n";

    text +=
      `👤 ${
        admin.display_name ||
        (admin.username
          ? "@" + admin.username
          : "ادمین")
      }\n`;

    text +=
      `🎭 نقش: ${
        admin.role_name ||
        "نامشخص"
      }\n\n`;

    text +=
      "وضعیت هر Permission:\n";

    text +=
      "🟢 فعال = Override روشن\n";

    text +=
      "🔴 غیرفعال = Override خاموش\n";

    text +=
      "⚪ پیش‌فرض = تبعیت از Role\n\n";

    permissions.forEach(
      (permission, index) => {
        text +=
          `${getPermissionStatusIcon(
            permission
          )} ${index + 1}️⃣ ${
            permission.permission_name
          }`;

        text +=
          `\n   🔑 ${permission.permission_key}`;

        text +=
          `\n   📌 وضعیت: ${getPermissionStatusText(
            permission
          )}`;

        text += "\n\n";
      }
    );

    text +=
      "روی هر گزینه بزنید تا وضعیت آن تغییر کند.";

    await ctx.reply(
      text,
      buildPermissionToggleMenu(
        permissions
      )
    );
  } catch (error) {
    console.error(
      "Access management failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت دسترسی‌های ادمین انجام نشد.",
      adminSettingsMenu()
    );
  }
}

async function togglePermission(
  ctx,
  targetTelegramUserId,
  permissionKey
) {
  if (!(await requireManage(ctx))) {
    return;
  }

  try {
    const access =
      await adminManagementService.getPermissionMatrix(
        targetTelegramUserId
      );

    if (!access?.admin) {
      await ctx.reply(
        "❌ ادمین پیدا نشد."
      );

      return;
    }

    if (
      access.admin.role_key ===
      "super_admin"
    ) {
      clearState(ctx.from.id);

      await ctx.reply(
        "⛔ دسترسی Super Admin قابل ویرایش نیست.",
        managementMenu()
      );

      return;
    }

    const permission =
      normalizePermissionList(
        access.permissions
      ).find(
        (item) =>
          item.permission_key ===
          permissionKey
      );

    if (!permission) {
      await ctx.reply(
        "❌ Permission موردنظر پیدا نشد."
      );

      return;
    }

    let message;

    if (
      permission.override_enabled ===
      undefined ||
      permission.override_enabled ===
      null
    ) {
      await adminManagementService.setPermissionOverride(
        targetTelegramUserId,
        permissionKey,
        true
      );

      message =
        "🟢 دسترسی به‌صورت Override فعال شد.";
    } else if (
      permission.override_enabled ===
      true
    ) {
      await adminManagementService.setPermissionOverride(
        targetTelegramUserId,
        permissionKey,
        false
      );

      message =
        "🔴 دسترسی به‌صورت Override غیرفعال شد.";
    } else {
      await adminManagementService.resetPermissionOverride(
        targetTelegramUserId,
        permissionKey
      );

      message =
        "⚪ Override حذف شد و دسترسی به حالت پیش‌فرض برگشت.";
    }

    await ctx.reply(message);

    await showAccessManagement(
      ctx,
      targetTelegramUserId
    );
  } catch (error) {
    console.error(
      "Toggle permission failed:",
      error
    );

    throw error;
  }
}

async function resetAllPermissionOverrides(
  ctx,
  targetTelegramUserId
) {
  if (!(await requireManage(ctx))) {
    return;
  }

  try {
    const access =
      await adminManagementService.getPermissionMatrix(
        targetTelegramUserId
      );

    if (!access?.admin) {
      await ctx.reply(
        "❌ ادمین پیدا نشد."
      );

      return;
    }

    if (
      access.admin.role_key ===
      "super_admin"
    ) {
      clearState(ctx.from.id);

      await ctx.reply(
        "⛔ دسترسی‌های Super Admin قابل ویرایش نیست.",
        managementMenu()
      );

      return;
    }

    const permissions =
      normalizePermissionList(
        access.permissions
      );

    let resetCount = 0;

    for (const permission of permissions) {
      if (
        permission.override_enabled !==
          undefined &&
        permission.override_enabled !==
          null
      ) {
        await adminManagementService.resetPermissionOverride(
          targetTelegramUserId,
          permission.permission_key
        );

        resetCount++;
      }
    }

    await ctx.reply(
      resetCount > 0
        ? `🔄 ${resetCount} Override بازنشانی شد.`
        : "ℹ️ هیچ Overrideای برای بازنشانی وجود نداشت."
    );

    await showAccessManagement(
      ctx,
      targetTelegramUserId
    );
  } catch (error) {
    console.error(
      "Reset all permission overrides failed:",
      error
    );

    throw error;
  }
}

async function showRoles(
  ctx,
  targetTelegramUserId
) {
  if (!(await requireManage(ctx))) {
    return;
  }

  try {
    const roles =
      await adminManagementService.getRoles();

    if (!roles.length) {
      await ctx.reply(
        "❌ هیچ Role قابل انتخابی وجود ندارد."
      );

      return;
    }

    setState(
      ctx.from.id,
      {
        step: "changeRole",
        targetUserId:
          targetTelegramUserId,
        choices:
          roles.map(
            (role) =>
              role.role_key
          ),
      }
    );

    const buttons =
      roles.map(
        (role, index) => [
          `${index + 1}️⃣ ${role.role_name}`,
        ]
      );

    buttons.push([
      "🔙 تنظیمات ادمین",
    ]);

    await ctx.reply(
      "🔄 سطح ادمین را انتخاب کنید:",
      Markup.keyboard(
        buttons
      ).resize()
    );
  } catch (error) {
    console.error(
      "Roles list failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت سطح‌های ادمین انجام نشد."
    );
  }
}

async function addAdmin(ctx) {
  if (!(await requireManage(ctx))) {
    return;
  }

  setState(
    ctx.from.id,
    {
      step: "addAdmin",
    }
  );

  await ctx.reply(
    "➕ افزودن ادمین\n\n" +
      "شناسه عددی Telegram کاربر را ارسال کنید.\n\n" +
      "مثال:\n" +
      "123456789\n\n" +
      "کاربر باید قبلاً ربات را /start کرده باشد.",
    cancelMenu()
  );
}

async function handleText(
  ctx,
  next
) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return next();
  }

  const state =
    getState(telegramUserId);

  if (!state) {
    return next();
  }

  const text =
    typeof ctx.message?.text ===
    "string"
      ? ctx.message.text.trim()
      : "";

  if (!text) {
    return;
  }

  if (
    text === CANCEL_TEXT ||
    text === "/cancel"
  ) {
    clearState(
      telegramUserId
    );

    await ctx.reply(
      "❌ عملیات لغو شد.",
      managementMenu()
    );

    return;
  }

  try {
    if (
      state.step ===
      "selectAdmin"
    ) {
      if (
        !(await requireView(ctx))
      ) {
        clearState(
          telegramUserId
        );

        return;
      }

      const match =
  text.match(/(\d+)️⃣/);

const selectedIndex =
  match
    ? Number(match[1])
    : NaN;

      if (
        !Number.isInteger(
          selectedIndex
        ) ||
        selectedIndex < 1 ||
        selectedIndex >
          state.choices.length
      ) {
        await ctx.reply(
          "❌ گزینه نامعتبر است."
        );

        return;
      }

      const targetUserId =
        state.choices[
          selectedIndex - 1
        ];

      await showAdminSettings(
        ctx,
        targetUserId
      );

      return;
    }

    if (
      state.step ===
      "permissionToggle"
    ) {
      if (
        text ===
        "🔄 بازنشانی همه"
      ) {
        await resetAllPermissionOverrides(
          ctx,
          state.targetUserId
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

      const match =
  text.match(/(\d+)️⃣/);

const selectedIndex =
  match
    ? Number(match[1])
    : NaN;

      if (
        !Number.isInteger(
          selectedIndex
        ) ||
        selectedIndex < 1 ||
        selectedIndex >
          state.choices.length
      ) {
        await ctx.reply(
          "❌ گزینه نامعتبر است."
        );

        return;
      }

      const permissionKey =
        state.choices[
          selectedIndex - 1
        ];

      await togglePermission(
        ctx,
        state.targetUserId,
        permissionKey
      );

      return;
    }

    if (
      state.step ===
      "changeRole"
    ) {
      if (
        !(await requireManage(ctx))
      ) {
        clearState(
          telegramUserId
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

      const selectedIndex =
        Number(
          text
            .split("️⃣")[0]
            .trim()
        );

      if (
        !Number.isInteger(
          selectedIndex
        ) ||
        selectedIndex < 1 ||
        selectedIndex >
          state.choices.length
      ) {
        await ctx.reply(
          "❌ گزینه نامعتبر است."
        );

        return;
      }

      const roleKey =
        state.choices[
          selectedIndex - 1
        ];

      await adminManagementService.changeAdminRole(
        state.targetUserId,
        roleKey
      );

      clearState(
        telegramUserId
      );

      await ctx.reply(
        "✅ سطح ادمین تغییر کرد.",
        adminSettingsMenu()
      );

      setState(
        telegramUserId,
        {
          step: "adminSettings",
          targetUserId:
            state.targetUserId,
        }
      );

      return;
    }

    if (
      state.step ===
      "addAdmin"
    ) {
      if (
        !(await requireManage(ctx))
      ) {
        clearState(
          telegramUserId
        );

        return;
      }

      if (
        !/^\d+$/.test(text)
      ) {
        await ctx.reply(
          "❌ شناسه Telegram باید فقط عدد باشد.",
          cancelMenu()
        );

        return;
      }

      await adminManagementService.addAdmin(
        text
      );

      clearState(
        telegramUserId
      );

      await ctx.reply(
        "✅ ادمین با موفقیت اضافه شد.",
        managementMenu()
      );

      return;
    }

    if (
      state.step ===
      "adminSettings"
    ) {
      if (
        text ===
        "📋 اطلاعات ادمین"
      ) {
        await showAdminInfo(
          ctx,
          state.targetUserId
        );

        return;
      }

      if (
        text ===
        "🔐 مدیریت دسترسی"
      ) {
        await showAccessManagement(
          ctx,
          state.targetUserId
        );

        return;
      }

      if (
        text ===
        "🔄 تغییر سطح ادمین"
      ) {
        await showRoles(
          ctx,
          state.targetUserId
        );

        return;
      }

      if (
        text ===
        "🟢 فعال کردن"
      ) {
        if (
          !(await requireManage(ctx))
        ) {
          return;
        }

        await adminManagementService.setAdminActive(
          state.targetUserId,
          true
        );

        await ctx.reply(
          "🟢 ادمین فعال شد.",
          adminSettingsMenu()
        );

        return;
      }

      if (
        text ===
        "🔴 غیرفعال کردن"
      ) {
        if (
          !(await requireManage(ctx))
        ) {
          return;
        }

        await adminManagementService.setAdminActive(
          state.targetUserId,
          false
        );

        await ctx.reply(
          "🔴 ادمین غیرفعال شد.",
          adminSettingsMenu()
        );

        return;
      }

      if (
        text ===
        "🗑 حذف ادمین"
      ) {
        if (
          !(await requireManage(ctx))
        ) {
          return;
        }

        await adminManagementService.removeAdmin(
          state.targetUserId
        );

        clearState(
          telegramUserId
        );

        await ctx.reply(
          "🗑 ادمین حذف شد.",
          managementMenu()
        );

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
        await showAdminManagementMenu(
          ctx
        );

        return;
      }

      return;
    }
  } catch (error) {
    console.error(
      "Admin management handler failed:",
      error
    );

    clearState(
      telegramUserId
    );

    if (
      error.code ===
      "PERMISSION_DENIED"
    ) {
      await ctx.reply(
        "⛔ شما دسترسی لازم برای این عملیات را ندارید."
      );

      return;
    }

    if (
      error.code ===
      "ADMIN_ACCESS_DENIED"
    ) {
      await ctx.reply(
        "⛔ حساب مدیریتی شما فعال نیست."
      );

      return;
    }

    if (
      error.code ===
      "USER_NOT_FOUND"
    ) {
      await ctx.reply(
        "❌ کاربر پیدا نشد."
      );

      return;
    }

    if (
      error.code ===
      "SUPER_ADMIN_REQUIRED"
    ) {
      await ctx.reply(
        "⛔ این عملیات برای Super Admin مجاز نیست."
      );

      return;
    }

    await ctx.reply(
      "❌ عملیات انجام نشد.\n\n" +
        "خطا در سرور ثبت شد.",
      managementMenu()
    );
  }
}

function createAdminManagementHandler(
  bot
) {
  bot.hears(
    "🛠 مدیریت ادمین",
    showAdminManagementMenu
  );

  bot.hears(
    "👥 لیست ادمین‌ها",
    showAdminList
  );

  bot.hears(
    "➕ افزودن ادمین",
    addAdmin
  );

  bot.on(
    "text",
    handleText
  );
}

module.exports = {
  createAdminManagementHandler,
};
