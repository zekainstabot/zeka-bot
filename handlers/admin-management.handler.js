const {
  Markup,
} = require("telegraf");

const adminManagementService = require(
  "../services/admin-management.service"
);

const adminManagementStates = new Map();

const CANCEL_TEXT = "❌ لغو";

const PERMISSION_VIEW = "admins.view";
const PERMISSION_MANAGE = "admins.manage";

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
    ["🐞 تنظیم ادمین گزارش"],
    ["🗑 حذف ادمین"],
    ["🔙 لیست ادمین‌ها"],
    ["🔙 مدیریت ادمین"],
  ]).resize();
}

function accessManagementMenu() {
  return Markup.keyboard([
    ["📋 مشاهده دسترسی‌ها"],
    ["➕ افزودن دسترسی", "➖ حذف دسترسی"],
    ["🔙 تنظیمات ادمین"],
  ]).resize();
}

function cancelMenu() {
  return Markup.keyboard([
    [CANCEL_TEXT],
  ]).resize();
}

function getAdminDisplayName(admin, index) {
  if (admin.display_name) {
    return admin.display_name;
  }

  if (admin.username) {
    return `@${admin.username}`;
  }

  return `ادمین ${index + 1}`;
}

function buildAdminList(admins) {
  const buttons = [];

  admins.forEach((admin, index) => {
    buttons.push([
      `${index + 1}️⃣ ${getAdminDisplayName(
        admin,
        index
      )}`,
    ]);
  });

  buttons.push([
    "🔙 مدیریت ادمین",
  ]);

  return Markup.keyboard(buttons).resize();
}

function buildPermissionList(
  permissions,
  action
) {
  const buttons = [];

  permissions.forEach(
    (permission, index) => {
      buttons.push([
        `${index + 1}️⃣ ${permission.permission_name}`,
      ]);
    }
  );

  buttons.push([
    "🔙 مدیریت دسترسی",
  ]);

  return Markup.keyboard(buttons).resize();
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

async function requireView(
  ctx
) {
  return requirePermission(
    ctx,
    PERMISSION_VIEW
  );
}

async function requireManage(
  ctx
) {
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

async function showAdminList(
  ctx
) {
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

    if (
      !visibleAdmins.length
    ) {
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
          `${index + 1}️⃣ ${
            getAdminDisplayName(
              admin,
              index
            )
          }\n`;

        text +=
          `   نقش: ${
            admin.role_name
          }\n`;

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
            ? "@" +
              admin.username
            : "ادمین")
        }\n` +
        `🎭 نقش: ${
          admin.role_name
        }\n` +
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

    await ctx.reply(
      "📋 اطلاعات ادمین\n\n" +
        `👤 نام: ${
          admin.display_name ||
          "ثبت نشده"
        }\n` +
        `🔹 Username: ${
          admin.username
            ? "@" +
              admin.username
            : "ثبت نشده"
        }\n` +
        `🎭 نقش: ${
          admin.role_name
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

  setState(
    ctx.from.id,
    {
      step: "permissionMenu",
      targetUserId:
        targetTelegramUserId,
    }
  );

  await ctx.reply(
    "🔐 مدیریت دسترسی\n\n" +
      "عملیات موردنظر را انتخاب کنید:",
    accessManagementMenu()
  );
}

async function showPermissions(
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

    const permissions =
      access.permissions || [];

    if (!permissions.length) {
      await ctx.reply(
        "📋 این ادمین هیچ دسترسی‌ای ندارد.",
        accessManagementMenu()
      );

      return;
    }

    let text =
      "📋 دسترسی‌های ادمین\n\n";

    permissions.forEach(
      (permission, index) => {
        text +=
          `${index + 1}. ${
            permission.permission_name
          }\n`;

        text +=
          `   🔑 ${
            permission.permission_key
          }\n`;

        text +=
          `   📌 منبع: ${
            permission.source ===
            "direct"
              ? "مستقیم"
              : "نقش"
          }\n\n`;
      }
    );

    await ctx.reply(
      text,
      accessManagementMenu()
    );
  } catch (error) {
    console.error(
      "Show permissions failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت دسترسی‌ها انجام نشد."
    );
  }
}

async function startPermissionChange(
  ctx,
  targetTelegramUserId,
  action
) {
  if (!(await requireManage(ctx))) {
    return;
  }

  try {
    let permissions;

    if (action === "add") {
      const current =
        await adminManagementService.getDirectPermissions(
          targetTelegramUserId
        );

      const all =
        await adminManagementService.getAllPermissions();

      const currentKeys =
        new Set(
          current.map(
            (item) =>
              item.permission_key
          )
        );

      permissions =
        all.filter(
          (item) =>
            !currentKeys.has(
              item.permission_key
            )
        );
    } else {
      permissions =
        await adminManagementService.getDirectPermissions(
          targetTelegramUserId
        );
    }

    if (!permissions.length) {
      await ctx.reply(
        action === "add"
          ? "ℹ️ دسترسی جدیدی برای افزودن وجود ندارد."
          : "ℹ️ هیچ دسترسی مستقیم برای حذف وجود ندارد.",
        accessManagementMenu()
      );

      return;
    }

    setState(
      ctx.from.id,
      {
        step:
          action === "add"
            ? "addPermission"
            : "removePermission",
        targetUserId:
          targetTelegramUserId,
        choices:
          permissions.map(
            (permission) =>
              permission.permission_key
          ),
      }
    );

    await ctx.reply(
      action === "add"
        ? "➕ دسترسی موردنظر را انتخاب کنید:"
        : "➖ دسترسی مستقیم موردنظر را انتخاب کنید:",
      buildPermissionList(
        permissions,
        action
      )
    );
  } catch (error) {
    console.error(
      "Permission change start failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت لیست دسترسی‌ها انجام نشد.",
      accessManagementMenu()
    );
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

async function addAdmin(
  ctx
) {
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
      "addPermission" ||
      state.step ===
      "removePermission"
    ) {
      if (
        !(await requireManage(ctx))
      ) {
        clearState(
          telegramUserId
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

      const permissionKey =
        state.choices[
          selectedIndex - 1
        ];

      if (
        state.step ===
        "addPermission"
      ) {
        await adminManagementService.addPermission(
          state.targetUserId,
          permissionKey
        );

        clearState(
          telegramUserId
        );

        await ctx.reply(
          "✅ دسترسی اضافه شد.",
          accessManagementMenu()
        );

        setState(
          telegramUserId,
          {
            step: "permissionMenu",
            targetUserId:
              state.targetUserId,
          }
        );

        return;
      }

      await adminManagementService.removePermission(
        state.targetUserId,
        permissionKey
      );

      clearState(
        telegramUserId
      );

      await ctx.reply(
        "✅ دسترسی مستقیم حذف شد.",
        accessManagementMenu()
      );

      setState(
        telegramUserId,
        {
          step: "permissionMenu",
          targetUserId:
            state.targetUserId,
        }
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
      "permissionMenu"
    ) {
      if (
        text ===
        "📋 مشاهده دسترسی‌ها"
      ) {
        await showPermissions(
          ctx,
          state.targetUserId
        );

        return;
      }

      if (
        text ===
        "➕ افزودن دسترسی"
      ) {
        await startPermissionChange(
          ctx,
          state.targetUserId,
          "add"
        );

        return;
      }

      if (
        text ===
        "➖ حذف دسترسی"
      ) {
        await startPermissionChange(
          ctx,
          state.targetUserId,
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
        "🐞 تنظیم ادمین گزارش"
      ) {
        if (
          !(await requireManage(ctx))
        ) {
          return;
        }

        await adminManagementService.setReportAdmin(
          state.targetUserId
        );

        await ctx.reply(
          "🐞 این ادمین به‌عنوان ادمین گزارش تنظیم شد.",
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
        await showAdminList(
          ctx
        );

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
        "⛔ این عملیات فقط برای Super Admin مجاز است."
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
