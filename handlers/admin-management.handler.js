const {
  Markup,
} = require("telegraf");

const adminService = require(
  "../services/admin-management.service"
);

const {
  setUserCommands,
} = require(
  "../services/command.service"
);

const states = new Map();

const CANCEL_TEXT = "❌ لغو";

function adminManagementMenu() {
  return Markup.keyboard([
    ["➕ افزودن ادمین"],
    ["👥 لیست ادمین‌ها"],
    ["🔐 مدیریت سطح دسترسی"],
    ["🟢 فعال کردن ادمین"],
    ["🔴 غیرفعال کردن ادمین"],
    ["🗑 حذف ادمین"],
    ["🔙 پنل Super Admin"],
  ]).resize();
}

function accessManagementMenu() {
  return Markup.keyboard([
    ["👤 انتخاب ادمین"],
    ["📋 مشاهده دسترسی‌ها"],
    ["🔄 تغییر سطح ادمین"],
    ["🔙 مدیریت ادمین"],
  ]).resize();
}

function cancelMenu() {
  return Markup.keyboard([
    [CANCEL_TEXT],
  ]).resize();
}

async function requireSuperAdmin(ctx) {
  const {
    getAdminByTelegramId,
  } = require(
    "../services/admin.service"
  );

  const admin =
    await getAdminByTelegramId(
      ctx.from?.id
    );

  if (
    !admin ||
    !admin.is_active ||
    admin.role_key !== "super_admin"
  ) {
    await ctx.reply(
      "⛔ فقط Super Admin به مدیریت ادمین دسترسی دارد."
    );

    return false;
  }

  return true;
}

async function handleAdminManagementMenu(ctx) {
  if (!(await requireSuperAdmin(ctx))) {
    return;
  }

  await ctx.reply(
    "🛠 مدیریت ادمین\n\n" +
      "عملیات موردنظر را انتخاب کنید.",
    adminManagementMenu()
  );
}

async function handleListAdmins(ctx) {
  if (!(await requireSuperAdmin(ctx))) {
    return;
  }

  try {
    const admins =
      await adminService.listAdmins();

    if (!admins.length) {
      await ctx.reply(
        "👥 هیچ ادمینی ثبت نشده است.",
        adminManagementMenu()
      );

      return;
    }

    const lines = admins.map(
      (admin, index) => {
        const name =
          admin.display_name ||
          (
            admin.username
              ? `@${admin.username}`
              : "بدون نام"
          );

        const status =
          admin.is_active
            ? "🟢 فعال"
            : "🔴 غیرفعال";

        return (
          `${index + 1}. ${name}\n` +
          `🆔 ${admin.telegram_user_id}\n` +
          `👤 ${admin.role_name}\n` +
          `${status}`
        );
      }
    );

    await ctx.reply(
      "👥 لیست ادمین‌ها\n\n" +
        lines.join("\n\n"),
      adminManagementMenu()
    );
  } catch (error) {
    console.error(
      "List admins failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت لیست ادمین‌ها انجام نشد.",
      adminManagementMenu()
    );
  }
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

async function updateUserCommands(
  ctx,
  telegramUserId,
  role
) {
  try {
    await setUserCommands(
      ctx.telegram,
      telegramUserId,
      role
    );
  } catch (error) {
    console.error(
      "Failed to update user commands:",
      error
    );
  }
}

async function showAdminAccess(
  ctx,
  telegramUserId
) {
  const data =
    await adminService.getAdminAccess(
      telegramUserId
    );

  const {
    user,
    admin,
    permissions,
  } = data;

  const name =
    user.display_name ||
    (
      user.username
        ? `@${user.username}`
        : "بدون نام"
    );

  const status =
    admin.is_active
      ? "🟢 فعال"
      : "🔴 غیرفعال";

  let message =
    "🔐 اطلاعات دسترسی ادمین\n\n" +
    `👤 ${name}\n` +
    `🆔 ${user.telegram_user_id}\n` +
    `🎭 سطح: ${admin.role_name}\n` +
    `${status}\n\n` +
    "📋 دسترسی‌ها:\n";

  if (!permissions.length) {
    message +=
      "❌ هیچ دسترسی‌ای برای این Role ثبت نشده است.";
  } else {
    message += permissions
      .map(
        (permission, index) =>
          `${index + 1}. ${permission.permission_name}` +
          (
            permission.description
              ? ` — ${permission.description}`
              : ""
          )
      )
      .join("\n");
  }

  await ctx.reply(
    message,
    accessManagementMenu()
  );
}

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
    states.get(
      String(telegramUserId)
    );

  if (!state) {
    return next();
  }

  const text =
    String(
      ctx.message?.text || ""
    ).trim();

  if (
    text === CANCEL_TEXT ||
    text === "/cancel"
  ) {
    states.delete(
      String(telegramUserId)
    );

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

  if (
    Date.now() -
      state.createdAt >
    10 * 60 * 1000
  ) {
    states.delete(
      String(telegramUserId)
    );

    await ctx.reply(
      "⏱ زمان عملیات تمام شده است.",
      adminManagementMenu()
    );

    return;
  }

  if (!(await requireSuperAdmin(ctx))) {
    states.delete(
      String(telegramUserId)
    );

    return;
  }

  /*
   * مشاهده دسترسی‌ها
   */
  if (
    state.action ===
    "access_select"
  ) {
    if (!/^\d+$/.test(text)) {
      await ctx.reply(
        "❌ Telegram ID باید فقط عدد باشد.\n\n" +
          "مثال:\n" +
          "123456789",
        cancelMenu()
      );

      return;
    }

    try {
      const data =
        await adminService.getAdminAccess(
          text
        );

      if (
        data.admin.role_key ===
        "super_admin"
      ) {
        states.delete(
          String(telegramUserId)
        );

        await ctx.reply(
          "⛔ Super Admin قابل مدیریت از این بخش نیست.",
          accessManagementMenu()
        );

        return;
      }

      states.delete(
        String(telegramUserId)
      );

      await showAdminAccess(
        ctx,
        text
      );

      return;
    } catch (error) {
      console.error(
        "Get admin access failed:",
        error
      );

      states.delete(
        String(telegramUserId)
      );

      if (
        error.code ===
        "USER_NOT_FOUND"
      ) {
        await ctx.reply(
          "❌ کاربری با این Telegram ID پیدا نشد.\n\n" +
            "کاربر باید حداقل یک بار /start را زده باشد.",
          accessManagementMenu()
        );

        return;
      }

      if (
        error.code ===
        "ADMIN_NOT_FOUND"
      ) {
        await ctx.reply(
          "❌ این کاربر Admin نیست.",
          accessManagementMenu()
        );

        return;
      }

      await ctx.reply(
        "❌ دریافت دسترسی‌های ادمین انجام نشد.",
        accessManagementMenu()
      );

      return;
    }
  }

  /*
   * شروع تغییر Role
   */
  if (
    state.action ===
    "role_select"
  ) {
    if (!/^\d+$/.test(text)) {
      await ctx.reply(
        "❌ Telegram ID باید فقط عدد باشد.",
        cancelMenu()
      );

      return;
    }

    try {
      const data =
        await adminService.getAdminAccess(
          text
        );

      if (
        data.admin.role_key ===
        "super_admin"
      ) {
        states.delete(
          String(telegramUserId)
        );

        await ctx.reply(
          "⛔ Super Admin قابل تغییر نیست.",
          accessManagementMenu()
        );

        return;
      }

      const roles =
        await adminService.getRoles();

      if (!roles.length) {
        states.delete(
          String(telegramUserId)
        );

        await ctx.reply(
          "❌ هیچ Role قابل انتخابی وجود ندارد.",
          accessManagementMenu()
        );

        return;
      }

      states.set(
        String(telegramUserId),
        {
          action: "role_apply",
          createdAt: Date.now(),
          targetTelegramUserId: text,
          roles,
        }
      );

      const roleLines =
        roles.map(
          (role, index) =>
            `${index + 1}. ${role.role_name}\n` +
            `🔑 ${role.role_key}` +
            (
              role.description
                ? `\n📝 ${role.description}`
                : ""
            )
        );

      await ctx.reply(
        "🔄 تغییر سطح ادمین\n\n" +
          `🆔 ${text}\n\n` +
          "Role موردنظر را با شماره انتخاب کن:\n\n" +
          roleLines.join("\n\n"),
        cancelMenu()
      );

      return;
    } catch (error) {
      console.error(
        "Role selection failed:",
        error
      );

      states.delete(
        String(telegramUserId)
      );

      await ctx.reply(
        "❌ دریافت Roleها انجام نشد.",
        accessManagementMenu()
      );

      return;
    }
  }

  /*
   * اعمال Role
   */
  if (
    state.action ===
    "role_apply"
  ) {
    if (!/^\d+$/.test(text)) {
      await ctx.reply(
        "❌ شماره Role را درست وارد کن.",
        cancelMenu()
      );

      return;
    }

    const index =
      Number(text) - 1;

    if (
      index < 0 ||
      index >= state.roles.length
    ) {
      await ctx.reply(
        "❌ شماره Role نامعتبر است.",
        cancelMenu()
      );

      return;
    }

    const selectedRole =
      state.roles[index];

    try {
      await adminService.changeAdminRole(
        state.targetTelegramUserId,
        selectedRole.role_key
      );

      await updateUserCommands(
        ctx,
        state.targetTelegramUserId,
        selectedRole.role_key
      );

      states.delete(
        String(telegramUserId)
      );

      await ctx.reply(
        "✅ سطح ادمین تغییر کرد.\n\n" +
          `🆔 ${state.targetTelegramUserId}\n` +
          `🎭 سطح جدید: ${selectedRole.role_name}\n` +
          `🔑 ${selectedRole.role_key}`,
        accessManagementMenu()
      );

      return;
    } catch (error) {
      console.error(
        "Role change failed:",
        error
      );

      states.delete(
        String(telegramUserId)
      );

      if (
        error.code ===
        "SUPER_ADMIN_PROTECTED"
      ) {
        await ctx.reply(
          "⛔ Super Admin قابل تغییر نیست.",
          accessManagementMenu()
        );

        return;
      }

      await ctx.reply(
        "❌ تغییر سطح ادمین انجام نشد.",
        accessManagementMenu()
      );

      return;
    }
  }

  /*
   * عملیات‌های معمول مدیریت ادمین
   */
  if (!/^\d+$/.test(text)) {
    await ctx.reply(
      "❌ Telegram ID باید فقط عدد باشد.\n\n" +
        "مثال:\n" +
        "123456789",
      cancelMenu()
    );

    return;
  }

  states.delete(
    String(telegramUserId)
  );

  try {
    if (
      state.action ===
      "add"
    ) {
      await adminService.addAdmin(
        text
      );

      await updateUserCommands(
        ctx,
        text,
        "admin"
      );

      await ctx.reply(
        "✅ کاربر با موفقیت به عنوان Admin اضافه شد.\n\n" +
          `🆔 ${text}`,
        adminManagementMenu()
      );

      return;
    }

    if (
      state.action ===
      "enable"
    ) {
      const result =
        await adminService.setAdminActive(
          text,
          true
        );

      await updateUserCommands(
        ctx,
        text,
        result.role_key || "admin"
      );

      await ctx.reply(
        "🟢 ادمین فعال شد.\n\n" +
          `🆔 ${text}`,
        adminManagementMenu()
      );

      return;
    }

    if (
      state.action ===
      "disable"
    ) {
      await adminService.setAdminActive(
        text,
        false
      );

      await updateUserCommands(
        ctx,
        text,
        "user"
      );

      await ctx.reply(
        "🔴 ادمین غیرفعال شد.\n\n" +
          `🆔 ${text}`,
        adminManagementMenu()
      );

      return;
    }

    if (
      state.action ===
      "remove"
    ) {
      await adminService.removeAdmin(
        text
      );

      await updateUserCommands(
        ctx,
        text,
        "user"
      );

      await ctx.reply(
        "🗑 ادمین حذف شد.\n\n" +
          `🆔 ${text}`,
        adminManagementMenu()
      );

      return;
    }

    await ctx.reply(
      "❌ عملیات نامعتبر است.",
      adminManagementMenu()
    );
  } catch (error) {
    console.error(
      "Admin management operation failed:",
      error
    );

    if (
      error.code ===
      "USER_NOT_FOUND"
    ) {
      await ctx.reply(
        "❌ کاربری با این Telegram ID پیدا نشد.\n\n" +
          "کاربر باید حداقل یک بار /start را در ربات زده باشد.",
        adminManagementMenu()
      );

      return;
    }

    if (
      error.code ===
      "ALREADY_ADMIN"
    ) {
      await ctx.reply(
        "⚠️ این کاربر از قبل Admin است.",
        adminManagementMenu()
      );

      return;
    }

    if (
      error.code ===
      "ADMIN_NOT_FOUND"
    ) {
      await ctx.reply(
        "❌ این کاربر Admin نیست.",
        adminManagementMenu()
      );

      return;
    }

    if (
      error.code ===
      "SUPER_ADMIN_PROTECTED"
    ) {
      await ctx.reply(
        "⛔ Super Admin قابل تغییر یا حذف از این بخش نیست.",
        adminManagementMenu()
      );

      return;
    }

    await ctx.reply(
      "❌ عملیات انجام نشد.",
      adminManagementMenu()
    );
  }
}

function createAdminManagementHandler(bot) {
  /*
   * منوی اصلی مدیریت ادمین
   */
  bot.hears(
    "🛠 مدیریت ادمین",
    handleAdminManagementMenu
  );

  /*
   * افزودن ادمین
   */
  bot.hears(
    "➕ افزودن ادمین",
    async (ctx) => {
      if (!(await requireSuperAdmin(ctx))) {
        return;
      }

      startState(ctx, "add");

      await ctx.reply(
        "🆔 Telegram ID کاربری که می‌خواهی Admin شود را ارسال کن.",
        cancelMenu()
      );
    }
  );

  /*
   * لیست ادمین‌ها
   */
  bot.hears(
    "👥 لیست ادمین‌ها",
    handleListAdmins
  );

  /*
   * ورود به مدیریت دسترسی
   */
  bot.hears(
    "🔐 مدیریت سطح دسترسی",
    async (ctx) => {
      if (!(await requireSuperAdmin(ctx))) {
        return;
      }

      await ctx.reply(
        "🔐 مدیریت سطح دسترسی\n\n" +
          "عملیات موردنظر را انتخاب کن.",
        accessManagementMenu()
      );
    }
  );

  /*
   * انتخاب ادمین
   */
  bot.hears(
    "👤 انتخاب ادمین",
    async (ctx) => {
      if (!(await requireSuperAdmin(ctx))) {
        return;
      }

      startState(
        ctx,
        "access_select"
      );

      await ctx.reply(
        "🆔 Telegram ID ادمین را ارسال کن.",
        cancelMenu()
      );
    }
  );

  /*
   * مشاهده دسترسی‌ها
   */
  bot.hears(
    "📋 مشاهده دسترسی‌ها",
    async (ctx) => {
      if (!(await requireSuperAdmin(ctx))) {
        return;
      }

      startState(
        ctx,
        "access_select"
      );

      await ctx.reply(
        "📋 مشاهده دسترسی‌ها\n\n" +
          "🆔 Telegram ID ادمینی که می‌خواهی دسترسی‌هایش را ببینی ارسال کن.",
        cancelMenu()
      );
    }
  );

  /*
   * تغییر سطح ادمین
   */
  bot.hears(
    "🔄 تغییر سطح ادمین",
    async (ctx) => {
      if (!(await requireSuperAdmin(ctx))) {
        return;
      }

      startState(
        ctx,
        "role_select"
      );

      await ctx.reply(
        "🔄 تغییر سطح ادمین\n\n" +
          "🆔 Telegram ID ادمینی که می‌خواهی سطحش را تغییر بدهی ارسال کن.",
        cancelMenu()
      );
    }
  );

  /*
   * برگشت به مدیریت ادمین
   */
  bot.hears(
    "🔙 مدیریت ادمین",
    async (ctx) => {
      if (!(await requireSuperAdmin(ctx))) {
        return;
      }

      states.delete(
        String(ctx.from.id)
      );

      await ctx.reply(
        "🛠 مدیریت ادمین",
        adminManagementMenu()
      );
    }
  );

  /*
   * فعال کردن
   */
  bot.hears(
    "🟢 فعال کردن ادمین",
    async (ctx) => {
      if (!(await requireSuperAdmin(ctx))) {
        return;
      }

      startState(
        ctx,
        "enable"
      );

      await ctx.reply(
        "🆔 Telegram ID ادمینی که می‌خواهی فعال شود را ارسال کن.",
        cancelMenu()
      );
    }
  );

  /*
   * غیرفعال کردن
   */
  bot.hears(
    "🔴 غیرفعال کردن ادمین",
    async (ctx) => {
      if (!(await requireSuperAdmin(ctx))) {
        return;
      }

      startState(
        ctx,
        "disable"
      );

      await ctx.reply(
        "🆔 Telegram ID ادمینی که می‌خواهی غیرفعال شود را ارسال کن.",
        cancelMenu()
      );
    }
  );

  /*
   * حذف
   */
  bot.hears(
    "🗑 حذف ادمین",
    async (ctx) => {
      if (!(await requireSuperAdmin(ctx))) {
        return;
      }

      startState(
        ctx,
        "remove"
      );

      await ctx.reply(
        "🆔 Telegram ID ادمینی که می‌خواهی حذف شود را ارسال کن.",
        cancelMenu()
      );
    }
  );

  /*
   * متن‌های دارای State
   */
  bot.on(
    "text",
    handleAdminManagementText
  );
}

module.exports = {
  createAdminManagementHandler,
};
