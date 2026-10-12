
const { Markup } = require("telegraf");

const adminService = require("../services/admin.service");

const {
  createPurchaseRequest,
  getProManagers,
  getPurchaseRequestById,
  getLatestOpenPurchaseRequest,
  setPaymentCardNumber,
  submitPurchaseReceipt,
  reviewPurchaseRequest,
  ALLOWED_DURATIONS,
} = require("../services/pro-purchase.service");

cancelPurchaseRequest,

const purchaseFlow = new Map();

const durationKeyboard = Markup.keyboard([
  ["۱ ماهه", "۲ ماهه"],
  ["۳ ماهه", "۶ ماهه"],
  ["۱۲ ماهه"],
  ["🔙 بازگشت", "❌ لغو درخواست"],
]).resize().persistent();

const durationValues = {
  "۱ ماهه": 1,
  "۲ ماهه": 2,
  "۳ ماهه": 3,
  "۶ ماهه": 6,
  "۱۲ ماهه": 12,
  "1 ماهه": 1,
  "2 ماهه": 2,
  "3 ماهه": 3,
  "6 ماهه": 6,
  "12 ماهه": 12,
};

const reviewKeyboard = (requestId) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "✅ تأیید پرداخت و فعال‌سازی پرو",
        `pro_purchase_approve:${requestId}`
      ),
    ],
    [
      Markup.button.callback(
        "❌ رد رسید",
        `pro_purchase_reject:${requestId}`
      ),
    ],
  ]);

function formatUserName(user) {
  if (user.username) {
    return `@${user.username}`;
  }

  return user.display_name || "ثبت نشده";
}

function isMenuText(text) {
  return [
    "⭐ زکا پرو",
    "🔙 بازگشت",
    "❌ لغو درخواست",
    "/start",
    "/help",
  ].includes(String(text || "").trim());
}

async function getAuthorizedProAdmin(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return null;
  }

  const admin = await adminService.getAdminByTelegramId(
    telegramUserId
  );

  if (!admin || !admin.is_active) {
    return null;
  }

  const allowed = await adminService.hasPermission(
    admin.user_id,
    "pro"
  );

  return allowed ? admin : null;
}

function getRequestIdFromAdminReply(message) {
  const replyText = message?.reply_to_message?.text;

  if (!replyText) {
    return null;
  }

  const match = replyText.match(/شماره درخواست:\s*(\d+)/);

  return match ? match[1] : null;
}

async function notifyManagersAboutReceipt(ctx, request) {
  const managers = await getProManagers();
  let notified = 0;

  const details =
    "🧾 رسید پرداخت زکا پرو\n\n" +
    `🆔 شماره درخواست: ${request.id}\n` +
    `👤 نام: ${request.display_name || "ثبت نشده"}\n` +
    `🔹 نام کاربری: ${
      request.username ? "@" + request.username : "ندارد"
    }\n` +
    `🆔 شناسه تلگرام: ${request.telegram_user_id}\n` +
    `⏳ مدت اشتراک: ${request.duration_months} ماه\n\n` +
    "رسید را بررسی کن و یکی از گزینه‌های زیر را بزن.";

  for (const admin of managers) {
    try {
      if (request.receipt_type === "PHOTO") {
        await ctx.telegram.sendPhoto(
          admin.telegram_user_id,
          request.receipt_file_id,
          {
            caption: details,
            reply_markup: reviewKeyboard(request.id).reply_markup,
          }
        );
      } else {
        await ctx.telegram.sendMessage(
          admin.telegram_user_id,
          details +
            "\n\n📝 متن رسید:\n" +
            (request.receipt_text || "بدون متن"),
          {
            reply_markup: reviewKeyboard(request.id).reply_markup,
          }
        );
      }

      notified++;
    } catch (error) {
      console.error(
        `Pro receipt notification failed for admin ${admin.telegram_user_id}:`,
        error.message
      );
    }
  }

  return notified;
}


async function handleAdminCardReply(ctx) {
  const requestId = getRequestIdFromAdminReply(ctx.message);

  if (!requestId) {
    return false;
  }

  const admin = await getAuthorizedProAdmin(ctx);

  if (!admin) {
    return false;
  }

  const paymentDetails = String(
    ctx.message.text || ""
  ).trim();

  if (!paymentDetails || paymentDetails.length > 3500) {
    await ctx.reply(
      "❌ متن اطلاعات پرداخت خالی است یا بیش از حد طولانی است. حداکثر ۳۵۰۰ کاراکتر ارسال کن."
    );
    return true;
  }

  const request = await getPurchaseRequestById(requestId);

  if (!request) {
    await ctx.reply("❌ درخواست خرید پیدا نشد.");
    return true;
  }

  if (request.status !== "PENDING") {
    await ctx.reply(
      "⚠️ این درخواست دیگر در انتظار اعلام اطلاعات پرداخت نیست."
    );
    return true;
  }

  const updated = await setPaymentCardNumber({
    requestId,
    cardNumber: paymentDetails,
  });

  if (!updated) {
    await ctx.reply(
      "⚠️ وضعیت درخواست تغییر کرده است. اطلاعات پرداخت ارسال نشد."
    );
    return true;
  }

  try {
    await ctx.telegram.sendMessage(
      request.telegram_user_id,
      "💎 اطلاعات خرید زکا پرو\n\n" +
        `🆔 شماره درخواست: ${request.id}\n` +
        `⏳ مدت اشتراک: ${request.duration_months} ماه\n\n` +
        "📋 توضیحات و اطلاعات پرداخت:\n\n" +
        paymentDetails +
        "\n\n" +
        "پس از پرداخت، تصویر رسید را به همین ربات بفرست. " +
        "اگر تصویر نداری، اطلاعات رسید را به‌صورت متن ارسال کن."
    );

    await ctx.reply(
      `✅ اطلاعات پرداخت برای کاربر درخواست ${request.id} ارسال شد.`
    );
  } catch (error) {
    console.error(
      "Sending Pro payment details failed:",
      error.message
    );

    await ctx.reply(
      "⚠️ اطلاعات پرداخت در درخواست ثبت شد، اما ارسال پیام به کاربر ناموفق بود. ممکن است کاربر هنوز ربات را باز نکرده باشد."
    );
  }

  return true;
}

async function handleReceipt(ctx, receiptType, receiptText, receiptFileId) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return false;
  }

  const request = await getLatestOpenPurchaseRequest(telegramUserId);

  if (!request || request.status !== "WAITING_RECEIPT") {
    return false;
  }

  const updated = await submitPurchaseReceipt({
    requestId: request.id,
    telegramUserId,
    receiptType,
    receiptText,
    receiptFileId,
  });

  if (!updated) {
    await ctx.reply(
      "⚠️ رسید برای این درخواست ثبت نشد. ممکن است وضعیت درخواست تغییر کرده باشد."
    );
    return true;
  }

  let notified = 0;

  try {
    notified = await notifyManagersAboutReceipt(ctx, updated);
  } catch (error) {
    console.error("Pro receipt notification failed:", error);
  }

  if (notified === 0) {
    await ctx.reply(
      "⚠️ رسیدت ثبت شد، اما ارسال آن به ادمین‌ها موفق نبود. پشتیبانی باید درخواست را بررسی کند."
    );
    return true;
  }

  await ctx.reply(
    "✅ رسید پرداخت ثبت و برای ادمین‌های مربوطه ارسال شد.\n\n" +
      `🆔 شماره درخواست: ${updated.id}\n` +
      "پس از بررسی رسید، نتیجه به تو اعلام می‌شود."
  );

  return true;
}

async function handleReviewCallback(ctx, decision) {
  const admin = await getAuthorizedProAdmin(ctx);

  if (!admin) {
    await ctx.answerCbQuery(
      "⛔ اجازهٔ بررسی درخواست پرو را نداری.",
      { show_alert: true }
    );
    return;
  }

  const data = ctx.callbackQuery?.data || "";
  const match = data.match(/^pro_purchase_(approve|reject):(\d+)$/);

  if (!match) {
    await ctx.answerCbQuery("درخواست نامعتبر است.");
    return;
  }

  const requestId = match[2];

  try {
    const result = await reviewPurchaseRequest({
      requestId,
      reviewerTelegramUserId: ctx.from.id,
      decision,
    });

    if (!result.success) {
      await ctx.answerCbQuery(
        result.reason === "NOT_FOUND"
          ? "درخواست پیدا نشد."
          : "این درخواست قبلاً بررسی شده یا رسید آن ثبت نشده است.",
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
        "Removing Pro review buttons failed:",
        error.message
      );
    }

    if (decision === "APPROVED") {
      await ctx.answerCbQuery("پرداخت تأیید شد.");

      await ctx.reply(
        `✅ پرداخت درخواست ${request.id} تأیید و اشتراک پرو فعال شد.`
      );

      try {
        await ctx.telegram.sendMessage(
          request.telegram_user_id,
          "🎉 پرداختت تأیید شد!\n\n" +
            "اشتراک زکا پرو با موفقیت فعال شد.\n" +
            `⏳ مدت اشتراک: ${request.duration_months} ماه\n\n` +
            "از امکانات ویژهٔ زکا استفاده کن."
        );
      } catch (error) {
        console.error(
          "Pro approval user notification failed:",
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
            "لطفاً برای بررسی علت و هماهنگی پرداخت با پشتیبانی تماس بگیر."
        );
      } catch (error) {
        console.error(
          "Pro rejection user notification failed:",
          error.message
        );
      }
    }
  } catch (error) {
    console.error("Pro purchase review failed:", error);

    await ctx.answerCbQuery(
      "خطا هنگام بررسی درخواست. دوباره تلاش کن.",
      { show_alert: true }
    );
  }
}

function createProHandler({ bot, mainMenu }) {
  bot.hears("⭐ زکا پرو", async (ctx) => {
    purchaseFlow.set(ctx.from.id, true);

    await ctx.reply(
      "⭐ زکا پرو\n\n" +
        "با خرید پرو می‌توانی از امکانات ویژهٔ زکا استفاده کنی.\n\n" +
        "🚀 امکانات بیشتر\n" +
        "💎 انتخاب مدت اشتراک\n" +
        "🎁 امکانات ویژهٔ پرو\n\n" +
        "مدت اشتراک موردنظرت را انتخاب کن. پس از ثبت درخواست، ادمین اطلاعات پرداخت را برایت می‌فرستد.",
      durationKeyboard
    );
  });
  
  bot.hears(
    ["🔙 بازگشت", "❌ لغو درخواست"],
    async (ctx, next) => {
      const text = String(ctx.message?.text || "").trim();

      if (text === "❌ لغو درخواست") {
        try {
          const cancelled = await cancelPurchaseRequest(ctx.from.id);

          purchaseFlow.delete(ctx.from.id);

          await ctx.reply(
            cancelled
              ? `✅ درخواست خرید پرو شماره ${cancelled.id} لغو شد.`
              : purchaseFlow.has(ctx.from.id)
                ? "✅ فرایند خرید پرو لغو شد."
                : "ℹ️ درخواست بازی برای لغو وجود ندارد.",
            mainMenu
          );
        } catch (error) {
          console.error("Pro purchase cancellation failed:", error);
          await ctx.reply(
            "❌ لغو درخواست با خطا مواجه شد. دوباره تلاش کن.",
            mainMenu
          );
        }

        return;
      }

      if (!purchaseFlow.has(ctx.from.id)) {
        return next();
      }

      purchaseFlow.delete(ctx.from.id);
      await ctx.reply("به منوی اصلی برگشتی.", mainMenu);
    }
  );


  bot.hears(
    /^(۱|۲|۳|۶|۱۲|1|2|3|6|12) ماهه$/,
    async (ctx) => {
      if (!purchaseFlow.has(ctx.from.id)) {
        return;
      }

      const duration = durationValues[ctx.message.text];

      if (!ALLOWED_DURATIONS.includes(duration)) {
        return;
      }

      purchaseFlow.delete(ctx.from.id);

      try {
        const result = await createPurchaseRequest({
          telegramUserId: ctx.from.id,
          username: ctx.from.username,
          displayName: [
            ctx.from.first_name,
            ctx.from.last_name,
          ]
            .filter(Boolean)
            .join(" "),
          durationMonths: duration,
        });

        if (result.alreadyPending) {
          await ctx.reply(
            "⏳ یک درخواست خرید پرو از قبل ثبت شده و هنوز بررسی نشده است.\n\n" +
              `🆔 شماره درخواست: ${result.request.id}\n` +
              "پس از بررسی درخواست قبلی، می‌توانی درخواست جدید ثبت کنی.",
            mainMenu
          );
          return;
        }

        const request = result.request;
        const managers = await getProManagers();
        let notified = 0;

        for (const admin of managers) {
          try {
            await ctx.telegram.sendMessage(
              admin.telegram_user_id,
              "💎 درخواست خرید زکا پرو\n\n" +
                `🆔 شماره درخواست: ${request.id}\n` +
                `👤 نام: ${request.display_name || "ثبت نشده"}\n` +
                `🔹 نام کاربری: ${
                  request.username ? "@" + request.username : "ندارد"
                }\n` +
                `🆔 شناسه تلگرام: ${request.telegram_user_id}\n` +
                `⏳ مدت اشتراک: ${request.duration_months} ماه\n\n` +
                "برای ارسال شماره کارت، به همین پیام ریپلای کن و شماره کارت را بفرست."
            );

            notified++;
          } catch (error) {
            console.error(
              `Pro purchase notification failed for admin ${admin.telegram_user_id}:`,
              error.message
            );
          }
        }

        if (notified === 0) {
          await ctx.reply(
            "⚠️ درخواستت ثبت شد، اما پیام آن به ادمین‌ها ارسال نشد.\n\n" +
              `🆔 شماره درخواست: ${request.id}\n` +
              "لطفاً با پشتیبانی تماس بگیر.",
            mainMenu
          );
          return;
        }

        await ctx.reply(
          "✅ درخواست خرید پرو ثبت شد.\n\n" +
            `🆔 شماره درخواست: ${request.id}\n` +
            `⏳ مدت اشتراک: ${request.duration_months} ماه\n\n` +
            "به‌محض ارسال اطلاعات پرداخت توسط ادمین، می‌توانی پرداخت کنی و رسید را بفرستی.",
          mainMenu
        );
      } catch (error) {
        console.error("Pro purchase request failed:", error);

        await ctx.reply(
          "❌ ثبت درخواست با خطا مواجه شد. لطفاً کمی بعد دوباره تلاش کن.",
          mainMenu
        );
      }
    }
  );

  bot.action(/^pro_purchase_approve:\d+$/, async (ctx) => {
    await handleReviewCallback(ctx, "APPROVED");
  });

  bot.action(/^pro_purchase_reject:\d+$/, async (ctx) => {
    await handleReviewCallback(ctx, "REJECTED");
  });

  bot.on("text", async (ctx, next) => {
    try {
      const handledCardReply = await handleAdminCardReply(ctx);

      if (handledCardReply) {
        return;
      }

      const text = String(ctx.message?.text || "").trim();

      if (isMenuText(text)) {
        return next();
      }

      const handledReceipt = await handleReceipt(
        ctx,
        "TEXT",
        text,
        null
      );

      if (handledReceipt) {
        return;
      }
    } catch (error) {
      console.error("Pro text handler failed:", error);
    }

    return next();
  });

  bot.on("photo", async (ctx, next) => {
    try {
      const photos = ctx.message.photo || [];
      const largestPhoto = photos[photos.length - 1];

      if (!largestPhoto) {
        return next();
      }

      const handled = await handleReceipt(
        ctx,
        "PHOTO",
        null,
        largestPhoto.file_id
      );

      if (handled) {
        return;
      }
    } catch (error) {
      console.error("Pro photo handler failed:", error);
    }

    return next();
  });
}

module.exports = { createProHandler };
