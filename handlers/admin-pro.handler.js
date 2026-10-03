const {
  Markup,
} = require("telegraf");

const adminProService = require(
  "../services/admin-pro.service"
);

const adminProStates = new Map();

const CANCEL_TEXT = "❌ لغو";

const adminProMenu = Markup.keyboard([
  ["⭐ فعال‌سازی Pro", "⏳ تمدید Pro"],
  ["🟢 روشن کردن Pro", "🔴 خاموش کردن Pro"],
  ["❌ لغو Pro"],
  ["🔙 پنل Super Admin"],
]).resize();

const cancelMenu = Markup.keyboard([
  [CANCEL_TEXT],
]).resize();

function getState(userId) {
  return (
    adminProStates.get(userId) ||
    null
  );
}

function setState(userId, state) {
  adminProStates.set(
    userId,
    state
  );
}

function clearState(userId) {
  adminProStates.delete(
    userId
  );
}

function durationMenu() {
  return Markup.keyboard([
    ["1 ماه", "2 ماه"],
    ["3 ماه", "6 ماه"],
    ["12 ماه"],
    [CANCEL_TEXT],
  ]).resize();
}

function formatDate(value) {
  if (!value) {
    return "ندارد";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "نامعتبر";
  }

  return date.toLocaleDateString(
    "fa-IR",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  );
}

function durationFromText(text) {
  const map = {
    "1 ماه": 1,
    "2 ماه": 2,
    "3 ماه": 3,
    "6 ماه": 6,
    "12 ماه": 12,
  };

  return map[text] || null;
}

async function requireAccess(
  ctx
) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return false;
  }

  try {
    await adminProService
      .requireProManagePermission(
        telegramUserId
      );

    return true;
  } catch (error) {
    if (
      error.code ===
        "SUPER_ADMIN_REQUIRED" ||
      error.code ===
        "PERMISSION_DENIED"
    ) {
      await ctx.reply(
        "⛔ فقط Super Admin به مدیریت Pro دسترسی دارد."
      );

      return false;
    }

    await ctx.reply(
      "⛔ دسترسی به مدیریت Pro امکان‌پذیر نیست."
    );

    return false;
  }
}

async function startDurationFlow(
  ctx,
  action
) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  if (
    !(await requireAccess(ctx))
  ) {
    return;
  }

  setState(
    telegramUserId,
    {
      step: "targetUser",
      action,
    }
  );

  await ctx.reply(
    "👤 شناسه عددی تلگرام کاربر را ارسال کنید.\n\n" +
      "مثال:\n" +
      "123456789\n\n" +
      "برای لغو، «❌ لغو» را بزنید.",
    cancelMenu
  );
}

async function startSimpleFlow(
  ctx,
  action
) {
  const telegramUserId =
    ctx.from?.id;

  if (!telegramUserId) {
    return;
  }

  if (
    !(await requireAccess(ctx))
  ) {
    return;
  }

  setState(
    telegramUserId,
    {
      step: "targetUser",
      action,
    }
  );

  await ctx.reply(
    "👤 شناسه عددی تلگرام کاربر را ارسال کنید.\n\n" +
      "مثال:\n" +
      "123456789\n\n" +
      "برای لغو، «❌ لغو» را بزنید.",
    cancelMenu
  );
}

async function handleAdminProText(
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
      "❌ عملیات مدیریت Pro لغو شد.",
      adminProMenu
    );

    return;
  }

  try {
    switch (state.step) {
      case "targetUser": {
        if (
          !/^\d+$/.test(text)
        ) {
          await ctx.reply(
            "❌ شناسه تلگرام باید فقط عدد باشد.\n\n" +
              "مثال: 123456789",
            cancelMenu
          );

          return;
        }

        state.targetTelegramUserId =
          text;

        if (
          state.action ===
          "activate" ||
          state.action ===
          "renew"
        ) {
          state.step =
            "duration";

          await ctx.reply(
            "⏳ مدت Pro را انتخاب کنید:",
            durationMenu()
          );

          return;
        }

        if (
          state.action ===
          "disable"
        ) {
          const result =
            await adminProService
              .disablePro({
                telegramUserId,
                targetTelegramUserId:
                  text,
              });

          clearState(
            telegramUserId
          );

          await ctx.reply(
            "🔴 Pro کاربر خاموش شد.\n\n" +
              `👤 کاربر: ${
                result.username
                  ? "@" +
                    result.username
                  : result.telegram_user_id
              }\n` +
              `📅 تاریخ انقضا: ${formatDate(
                result.pro_expires_at
              )}`,
            adminProMenu
          );

          return;
        }

        if (
          state.action ===
          "enable"
        ) {
          const result =
            await adminProService
              .enablePro({
                telegramUserId,
                targetTelegramUserId:
                  text,
              });

          clearState(
            telegramUserId
          );

          await ctx.reply(
            "🟢 Pro کاربر روشن شد.\n\n" +
              `👤 کاربر: ${
                result.username
                  ? "@" +
                    result.username
                  : result.telegram_user_id
              }\n` +
              `📅 تاریخ انقضا: ${formatDate(
                result.pro_expires_at
              )}`,
            adminProMenu
          );

          return;
        }

        if (
          state.action ===
          "cancel"
        ) {
          const result =
            await adminProService
              .cancelPro({
                telegramUserId,
                targetTelegramUserId:
                  text,
              });

          clearState(
            telegramUserId
          );

          await ctx.reply(
            "❌ Pro کاربر لغو شد.\n\n" +
              `👤 کاربر: ${
                result.username
                  ? "@" +
                    result.username
                  : result.telegram_user_id
              }`,
            adminProMenu
          );

          return;
        }

        clearState(
          telegramUserId
        );

        await ctx.reply(
          "❌ عملیات نامعتبر است.",
          adminProMenu
        );

        return;
      }

      case "duration": {
        const duration =
          durationFromText(text);

        if (!duration) {
          await ctx.reply(
            "❌ مدت نامعتبر است.\n\n" +
              "یکی از گزینه‌های موجود را انتخاب کنید.",
            durationMenu()
          );

          return;
        }

        const method =
          state.action ===
          "renew"
            ? "renewPro"
            : "activatePro";

        const result =
          await adminProService[
            method
          ]({
            telegramUserId,
            targetTelegramUserId:
              state.targetTelegramUserId,
            durationMonths:
              duration,
          });

        clearState(
          telegramUserId
        );

        await ctx.reply(
          "✅ Pro با موفقیت فعال شد.\n\n" +
            `👤 کاربر: ${
              result.user.username
                ? "@" +
                  result.user.username
                : result.user.telegram_user_id
            }\n` +
            `⏳ مدت: ${duration} ماه\n` +
            `📅 شروع: ${formatDate(
              result.startsAt
            )}\n` +
            `📅 انقضا: ${formatDate(
              result.expiresAt
            )}`,
          adminProMenu
        );

        return;
      }

      default: {
        clearState(
          telegramUserId
        );

        await ctx.reply(
          "⚠️ وضعیت مدیریت Pro نامعتبر بود.",
          adminProMenu
        );

        return;
      }
    }
  } catch (error) {
    console.error(
      "Admin Pro handler failed:",
      error
    );

    clearState(
      telegramUserId
    );

    if (
      error.code ===
      "USER_NOT_FOUND"
    ) {
      await ctx.reply(
        "❌ کاربری با این Telegram ID در دیتابیس پیدا نشد.\n\n" +
          "اول باید کاربر ربات را /start کرده باشد.",
        adminProMenu
      );

      return;
    }

    if (
      error.code ===
      "PRO_EXPIRED"
    ) {
      await ctx.reply(
        "⚠️ Pro این کاربر منقضی شده است.\n\n" +
          "برای فعال‌سازی مجدد، از «⭐ فعال‌سازی Pro» یا «⏳ تمدید Pro» استفاده کنید.",
        adminProMenu
      );

      return;
    }

    if (
      error.code ===
      "SUPER_ADMIN_REQUIRED"
    ) {
      await ctx.reply(
        "⛔ فقط Super Admin می‌تواند Pro را مدیریت کند.",
        adminProMenu
      );

      return;
    }

    await ctx.reply(
      "❌ عملیات Pro انجام نشد.\n\n" +
        "خطا در سرور ثبت شد.",
      adminProMenu
    );
  }
}

function createAdminProHandler(
  bot
) {
  bot.hears(
    "⭐ فعال‌سازی Pro",
    (ctx) =>
      startDurationFlow(
        ctx,
        "activate"
      )
  );

  bot.hears(
    "⏳ تمدید Pro",
    (ctx) =>
      startDurationFlow(
        ctx,
        "renew"
      )
  );

  bot.hears(
    "🟢 روشن کردن Pro",
    (ctx) =>
      startSimpleFlow(
        ctx,
        "enable"
      )
  );

  bot.hears(
    "🔴 خاموش کردن Pro",
    (ctx) =>
      startSimpleFlow(
        ctx,
        "disable"
      )
  );

  bot.hears(
    "❌ لغو Pro",
    (ctx) =>
      startSimpleFlow(
        ctx,
        "cancel"
      )
  );

  bot.on(
    "text",
    handleAdminProText
  );
}

module.exports = {
  createAdminProHandler,
};
