
const { Markup } = require("telegraf");

const adminService = require("../services/admin.service");
const adminProService = require("../services/admin-pro.service");
const proPurchaseService = require("../services/pro-purchase.service");

const adminProStates = new Map();

const CANCEL_TEXT = "❌ لغو";

const cancelMenu = Markup.keyboard([
  [CANCEL_TEXT],
]).resize();

function getState(userId) {
  return adminProStates.get(userId) || null;
}

function setState(userId, state) {
  adminProStates.set(userId, state);
}

function clearState(userId) {
  adminProStates.delete(userId);
}

async function buildAdminProMenu(telegramUserId) {
  const admin = await adminService.getAdminByTelegramId(
    telegramUserId
  );

  const isSuperAdmin =
    admin?.is_active && admin.role_key === "super_admin";

  return Markup.keyboard([
    ["⭐ فعال‌سازی Pro", "⏳ تمدید Pro"],
    ["🟢 روشن کردن Pro", "🔴 خاموش کردن Pro"],
    ["📋 درخواست‌های خرید Pro"],
    ["❌ لغو Pro"],
    [
      isSuperAdmin
        ? "🔙 پنل Super Admin"
        : "🔙 پنل ادمین",
    ],
  ]).resize();
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
  if (!value) return "ندارد";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "نامعتبر";

  return date.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
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

async function requireAccess(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) return false;

  try {
    await adminProService.requireProManagePermission(
      telegramUserId
    );
    return true;
  } catch (error) {
    if (error.code === "PERMISSION_DENIED") {
      await ctx.reply(
        "⛔ مجوز مدیریت Pro برای حساب شما فعال نیست."
      );
      return false;
    }

    await ctx.reply(
      "⛔ دسترسی به مدیریت Pro امکان‌پذیر نیست."
    );
    return false;
  }
}

async function replyWithProMenu(ctx, message) {
  const menu = await buildAdminProMenu(ctx.from.id);
  await ctx.reply(message, menu);
}

async function startDurationFlow(ctx, action) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) return;
  if (!(await requireAccess(ctx))) return;

  setState(telegramUserId, {
    step: "targetUser",
    action,
  });

  await ctx.reply(
    "👤 شناسه عددی تلگرام کاربر را ارسال کنید.\n\n" +
      "مثال:\n123456789\n\n" +
      "برای لغو، دکمه «❌ لغو» را بزنید.",
    cancelMenu
  );
}

async function startSimpleFlow(ctx, action) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) return;
  if (!(await requireAccess(ctx))) return;

  setState(telegramUserId, {
    step: "targetUser",
    action,
  });

  await ctx.reply(
    "👤 شناسه عددی تلگرام کاربر را ارسال کنید.\n\n" +
      "مثال:\n123456789\n\n" +
      "برای لغو، دکمه «❌ لغو» را بزنید.",
    cancelMenu
  );
}

async function handleAdminProText(ctx, next) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) return next();

  const state = getState(telegramUserId);

  if (!state) return next();

  const text =
    typeof ctx.message?.text === "string"
      ? ctx.message.text.trim()
      : "";

  if (!text) return;

  if (text === CANCEL_TEXT || text === "/cancel") {
    clearState(telegramUserId);

    await replyWithProMenu(
      ctx,
      "❌ عملیات مدیریت Pro لغو شد."
    );
    return;
  }

  try {
    switch (state.step) {
      case "purchasePaymentDetails": {
        if (text.length > 3500) {
          await ctx.reply(
            "❌ اطلاعات پرداخت نباید بیشتر از ۳۵۰۰ کاراکتر باشد.",
            cancelMenu
          );
          return;
        }

        const request =
          await proPurchaseService.getPurchaseRequestById(
            state.requestId
          );

        if (!request || request.status !== "PENDING") {
          clearState(telegramUserId);

          await replyWithProMenu(
            ctx,
            "⚠️ این درخواست پیدا نشد یا دیگر منتظر اطلاعات پرداخت نیست."
          );
          return;
        }

        const updated =
          await proPurchaseService.setPaymentCardNumber({
            requestId: state.requestId,
            cardNumber: text,
          });

        if (!updated) {
          clearState(telegramUserId);

          await replyWithProMenu(
            ctx,
            "⚠️ وضعیت درخواست تغییر کرده است. اطلاعات پرداخت ارسال نشد."
          );
          return;
        }

        try {
          await ctx.telegram.sendMessage(
            request.telegram_user_id,
            "💎 اطلاعات خرید زکا پرو\n\n" +
              `🆔 شماره درخواست: ${request.id}\n` +
              `⏳ مدت اشتراک: ${request.duration_months} ماه\n\n` +
              "📋 اطلاعات پرداخت:\n\n" +
              text +
              "\n\nپس از پرداخت، تصویر رسید را به همین ربات بفرست. " +
              "اگر تصویر نداری، اطلاعات رسید را به‌صورت متن ارسال کن."
          );
        } catch (error) {
          console.error(
            "Sending Pro payment details failed:",
            error.message
          );

          clearState(telegramUserId);

          await replyWithProMenu(
            ctx,
            "⚠️ اطلاعات پرداخت در درخواست ثبت شد، اما ارسال پیام به کاربر ناموفق بود."
          );
          return;
        }

        clearState(telegramUserId);

        await replyWithProMenu(
          ctx,
          `✅ اطلاعات پرداخت برای درخواست ${request.id} ارسال شد.`
        );
        return;
      }

      case "targetUser": {
        if (!/^\d+$/.test(text)) {
          await ctx.reply(
            "❌ شناسه تلگرام باید فقط عدد باشد.\n\nمثال: 123456789",
            cancelMenu
          );
          return;
        }

        state.targetTelegramUserId = text;

        if (
          state.action === "activate" ||
          state.action === "renew"
        ) {
          state.step = "duration";

          await ctx.reply(
            "⏳ مدت Pro را انتخاب کنید:",
            durationMenu()
          );
          return;
        }

        if (state.action === "disable") {
          const result = await adminProService.disablePro({
            telegramUserId,
            targetTelegramUserId: text,
          });

          clearState(telegramUserId);

          await replyWithProMenu(
            ctx,
            "🔴 Pro کاربر خاموش شد.\n\n" +
              `👤 کاربر: ${
                result.username
                  ? "@" + result.username
                  : result.telegram_user_id
              }\n` +
              `📅 تاریخ انقضا: ${formatDate(
                result.pro_expires_at
              )}`
          );
          return;
        }

        if (state.action === "enable") {
          const result = await adminProService.enablePro({
            telegramUserId,
            targetTelegramUserId: text,
          });

          clearState(telegramUserId);

          await replyWithProMenu(
            ctx,
            "🟢 Pro کاربر روشن شد.\n\n" +
              `👤 کاربر: ${
                result.username
                  ? "@" + result.username
                  : result.telegram_user_id
              }\n` +
              `📅 تاریخ انقضا: ${formatDate(
                result.pro_expires_at
              )}`
          );
          return;
        }

        if (state.action === "cancel") {
          const result = await adminProService.cancelPro({
            telegramUserId,
            targetTelegramUserId: text,
          });

          clearState(telegramUserId);

          await replyWithProMenu(
            ctx,
            "❌ Pro کاربر لغو شد.\n\n" +
              `👤 کاربر: ${
                result.username
                  ? "@" + result.username
                  : result.telegram_user_id
              }`
          );
          return;
        }

        clearState(telegramUserId);

        await replyWithProMenu(
          ctx,
          "❌ عملیات نامعتبر است."
        );
        return;
      }

      case "duration": {
        const duration = durationFromText(text);

        if (!duration) {
          await ctx.reply(
            "❌ مدت نامعتبر است.\n\nیکی از گزینه‌های موجود را انتخاب کنید.",
            durationMenu()
          );
          return;
        }

        const method =
          state.action === "renew"
            ? "renewPro"
            : "activatePro";

        const result = await adminProService[method]({
          telegramUserId,
          targetTelegramUserId:
            state.targetTelegramUserId,
          durationMonths: duration,
        });

        clearState(telegramUserId);

        await replyWithProMenu(
          ctx,
          "✅ Pro با موفقیت فعال شد.\n\n" +
            `👤 کاربر: ${
              result.user.username
                ? "@" + result.user.username
                : result.user.telegram_user_id
            }\n` +
            `⏳ مدت: ${duration} ماه\n` +
            `📅 شروع: ${formatDate(result.startsAt)}\n` +
            `📅 انقضا: ${formatDate(result.expiresAt)}`
        );
        return;
      }

      default: {
        clearState(telegramUserId);

        await replyWithProMenu(
          ctx,
          "⚠️ وضعیت مدیریت Pro نامعتبر بود."
        );
        return;
      }
    }
  } catch (error) {
    console.error("Admin Pro handler failed:", error);

    clearState(telegramUserId);

    if (error.code === "USER_NOT_FOUND") {
      await replyWithProMenu(
        ctx,
        "❌ کاربری با این شناسه در دیتابیس پیدا نشد.\n\n" +
          "اول باید کاربر ربات را /start کرده باشد."
      );
      return;
    }

    if (error.code === "PRO_EXPIRED") {
      await replyWithProMenu(
        ctx,
        "⚠️ اشتراک Pro این کاربر منقضی شده است.\n\n" +
          "برای فعال‌سازی مجدد، از «⭐ فعال‌سازی Pro» یا «⏳ تمدید Pro» استفاده کنید."
      );
      return;
    }

    if (error.code === "PERMISSION_DENIED") {
      await ctx.reply(
        "⛔ مجوز مدیریت Pro برای حساب شما فعال نیست."
      );
      return;
    }

    if (error.code === "ADMIN_ACCESS_DENIED") {
      await ctx.reply(
        "⛔ حساب شما ادمین فعال نیست."
      );
      return;
    }

    await replyWithProMenu(
      ctx,
      "❌ عملیات Pro انجام نشد.\n\nخطا در سرور ثبت شد؛ لاگ Render را بررسی کنید."
    );
  }
}

async function showProPurchaseRequests(ctx) {
  if (!(await requireAccess(ctx))) return;

  try {
    const requests =
      await proPurchaseService.getPurchaseRequests({
        limit: 5,
      });

    if (!requests.length) {
      await ctx.reply(
        "📋 هیچ درخواست خرید Pro ثبت نشده است."
      );
      return;
    }

    const statusLabels = {
      PENDING: "در انتظار اطلاعات پرداخت",
      WAITING_RECEIPT: "در انتظار رسید",
      RECEIPT_SUBMITTED: "رسید ارسال شده؛ منتظر بررسی",
      APPROVED: "تأیید شده",
      REJECTED: "رد شده",
      CANCELLED: "لغو شده",
    };

    for (const request of requests) {
      const status =
        statusLabels[request.status] || request.status;

      const username = request.username
        ? `@${request.username}`
        : "ندارد";

      const displayName =
        request.display_name || "ثبت نشده";

      const details =
        `📋 درخواست خرید Pro\n\n` +
        `🆔 شماره درخواست: ${request.id}\n` +
        `👤 نام: ${displayName}\n` +
        `🔗 نام کاربری: ${username}\n` +
        `🆔 شناسه تلگرام: ${request.telegram_user_id}\n` +
        `⏳ مدت: ${request.duration_months} ماه\n` +
        `📌 وضعیت: ${status}`;

      if (request.status === "RECEIPT_SUBMITTED") {
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "✅ تأیید پرداخت",
              `admin_pro_purchase_approve:${request.id}`
            ),
            Markup.button.callback(
              "❌ رد رسید",
              `admin_pro_purchase_reject:${request.id}`
            ),
          ],
        ]);

        if (
          request.receipt_type === "PHOTO" &&
          request.receipt_file_id
        ) {
          await ctx.replyWithPhoto(
            request.receipt_file_id,
            {
              caption: details,
              reply_markup: keyboard.reply_markup,
            }
          );
        } else {
          await ctx.reply(
            details +
              "\n\n📝 متن رسید:\n" +
              (request.receipt_text || "بدون متن"),
            keyboard
          );
        }
      } else if (request.status === "PENDING") {
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "💳 ارسال اطلاعات پرداخت",
              `admin_pro_purchase_payment:${request.id}`
            ),
          ],
        ]);

        await ctx.reply(details, keyboard);
      } else {
        await ctx.reply(details);
      }
    }
  } catch (error) {
    console.error(
      "Show Pro purchase requests failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت درخواست‌های خرید Pro ناموفق بود. لاگ Render را بررسی کن."
    );
  }
}

async function startPaymentDetailsFlow(ctx) {
  if (!(await requireAccess(ctx))) {
    await ctx.answerCbQuery();
    return;
  }

  const match = String(
    ctx.callbackQuery?.data || ""
  ).match(/^admin_pro_purchase_payment:(\d+)$/);

  if (!match) {
    await ctx.answerCbQuery(
      "درخواست نامعتبر است.",
      { show_alert: true }
    );
    return;
  }

  const requestId = match[1];

  try {
    const request =
      await proPurchaseService.getPurchaseRequestById(
        requestId
      );

    if (!request || request.status !== "PENDING") {
      await ctx.answerCbQuery(
        "این درخواست دیگر در انتظار اطلاعات پرداخت نیست.",
        { show_alert: true }
      );
      return;
    }

    setState(ctx.from.id, {
      step: "purchasePaymentDetails",
      requestId,
    });

    await ctx.answerCbQuery();

    await ctx.reply(
      `💳 اطلاعات پرداخت برای درخواست ${requestId} را ارسال کن.\n\n` +
        "شماره کارت، نام صاحب کارت و توضیحات پرداخت را در یک پیام بنویس.\n\n" +
        "برای لغو، دکمه «❌ لغو» را بزن.",
      cancelMenu
    );
  } catch (error) {
    console.error(
      "Starting Pro payment details flow failed:",
      error
    );

    await ctx.answerCbQuery(
      "خطا در دریافت درخواست.",
      { show_alert: true }
    );
  }
}

async function reviewProPurchaseFromPanel(ctx, decision) {
  if (!(await requireAccess(ctx))) {
    await ctx.answerCbQuery();
    return;
  }

  try {
    const data = ctx.callbackQuery?.data || "";

    const match = data.match(
      /^admin_pro_purchase_(approve|reject):(\d+)$/
    );

    if (!match) {
      await ctx.answerCbQuery(
        "درخواست نامعتبر است.",
        { show_alert: true }
      );
      return;
    }

    const requestId = match[2];

    const result =
      await proPurchaseService.reviewPurchaseRequest({
        requestId,
        reviewerTelegramUserId: ctx.from.id,
        decision,
      });

    if (!result.success) {
      await ctx.answerCbQuery(
        result.reason === "NOT_FOUND"
          ? "درخواست پیدا نشد."
          : "این درخواست قبلاً بررسی شده یا رسید ندارد.",
        { show_alert: true }
      );
      return;
    }

    const request = result.request;

    try {
      await ctx.editMessageReplyMarkup({
        inline_keyboard: [],
      });
    } catch (error) {
      console.error(
        "Removing admin Pro purchase buttons failed:",
        error.message
      );
    }

    if (decision === "APPROVED") {
      await ctx.answerCbQuery("پرداخت تأیید شد.");

      await ctx.reply(
        `✅ درخواست ${request.id} تأیید شد و Pro فعال شد.`
      );

      try {
        await ctx.telegram.sendMessage(
          request.telegram_user_id,
          "🎉 پرداخت زکا پرو تأیید شد!\n\n" +
            "اشتراک پرو با موفقیت فعال شد.\n" +
            `⏳ مدت اشتراک: ${request.duration_months} ماه`
        );
      } catch (error) {
        console.error(
          "Admin panel Pro approval notification failed:",
          error.message
        );
      }
    } else {
      await ctx.answerCbQuery("رسید رد شد.");

      await ctx.reply(
        `❌ رسید درخواست ${request.id} رد شد.`
      );

      try {
        await ctx.telegram.sendMessage(
          request.telegram_user_id,
          "❌ رسید پرداخت زکا پرو تأیید نشد.\n\n" +
            `🆔 شماره درخواست: ${request.id}\n` +
            "لطفاً برای بررسی علت با پشتیبانی تماس بگیر."
        );
      } catch (error) {
        console.error(
          "Admin panel Pro rejection notification failed:",
          error.message
        );
      }
    }
  } catch (error) {
    console.error(
      "Admin panel Pro purchase review failed:",
      error
    );

    try {
      await ctx.answerCbQuery(
        "بررسی درخواست ناموفق بود.",
        { show_alert: true }
      );
    } catch (answerError) {
      console.error(
        "Answering Pro review callback failed:",
        answerError.message
      );
    }
  }
}

function createAdminProHandler(bot) {
  bot.hears(
    "⭐ فعال‌سازی Pro",
    (ctx) => startDurationFlow(ctx, "activate")
  );

  bot.hears(
    "📋 درخواست‌های خرید Pro",
    showProPurchaseRequests
  );

  bot.hears(
    "⏳ تمدید Pro",
    (ctx) => startDurationFlow(ctx, "renew")
  );

  bot.hears(
    "🟢 روشن کردن Pro",
    (ctx) => startSimpleFlow(ctx, "enable")
  );

  bot.hears(
    "🔴 خاموش کردن Pro",
    (ctx) => startSimpleFlow(ctx, "disable")
  );

  bot.hears(
    "❌ لغو Pro",
    (ctx) => startSimpleFlow(ctx, "cancel")
  );

  bot.action(
    /^admin_pro_purchase_payment:\d+$/,
    startPaymentDetailsFlow
  );

  bot.action(
    /^admin_pro_purchase_approve:\d+$/,
    (ctx) => reviewProPurchaseFromPanel(ctx, "APPROVED")
  );

  bot.action(
    /^admin_pro_purchase_reject:\d+$/,
    (ctx) => reviewProPurchaseFromPanel(ctx, "REJECTED")
  );

  bot.on("text", handleAdminProText);
}

module.exports = {
  createAdminProHandler,
};
