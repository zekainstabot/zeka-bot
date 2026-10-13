
const { Markup } = require("telegraf");

const {
  createPurchaseRequest,
  getLatestOpenPurchaseRequest,
  submitPurchaseReceipt,
  ALLOWED_DURATIONS,
  cancelPurchaseRequest,
} = require("../services/pro-purchase.service");

const purchaseFlow = new Map();

const durationKeyboard = Markup.keyboard([
  ["۱ ماهه", "۲ ماهه"],
  ["۳ ماهه", "۶ ماهه"],
  ["۱۲ ماهه"],
  ["🔙 بازگشت", "❌ لغو درخواست"],
])
  .resize()
  .persistent();

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

function isMenuText(text) {
  return [
    "⭐ زکا پرو",
    "🔙 بازگشت",
    "❌ لغو درخواست",
    "/start",
    "/help",
  ].includes(String(text || "").trim());
}

async function handleReceipt(
  ctx,
  receiptType,
  receiptText,
  receiptFileId
) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return false;
  }

  const request = await getLatestOpenPurchaseRequest(
    telegramUserId
  );

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
      "⚠️ رسید ثبت نشد. ممکن است وضعیت درخواست تغییر کرده باشد."
    );
    return true;
  }

  await ctx.reply(
    "✅ رسید پرداخت ثبت شد.\n\n" +
      `🆔 شماره درخواست: ${updated.id}\n` +
      "پس از بررسی رسید توسط ادمین، نتیجه به تو اعلام می‌شود."
  );

  return true;
}

function createProHandler({ bot, mainMenu }) {
  bot.hears("⭐ زکا پرو", async (ctx) => {
    purchaseFlow.set(ctx.from.id, true);

    await ctx.reply(
      "⭐ زکا پرو\n\n" +
        "با خرید پرو می‌توانی از امکانات ویژه زکا استفاده کنی.\n\n" +
        "🚀 امکانات بیشتر\n" +
        "💎 انتخاب مدت اشتراک\n" +
        "🎁 امکانات ویژه پرو\n\n" +
        "مدت اشتراک موردنظرت را انتخاب کن.",
      durationKeyboard
    );
  });

  bot.hears(
    ["🔙 بازگشت", "❌ لغو درخواست"],
    async (ctx, next) => {
      const text = String(
        ctx.message?.text || ""
      ).trim();

      if (text === "❌ لغو درخواست") {
        const wasInPurchaseFlow = purchaseFlow.has(
          ctx.from.id
        );

        try {
          const cancelled = await cancelPurchaseRequest(
            ctx.from.id
          );

          purchaseFlow.delete(ctx.from.id);

          let message;

          if (cancelled) {
            message =
              `✅ درخواست خرید پرو شماره ${cancelled.id} لغو شد.`;
          } else if (wasInPurchaseFlow) {
            message = "✅ فرایند خرید پرو لغو شد.";
          } else {
            message = "ℹ️ درخواست فعالی برای لغو وجود ندارد.";
          }

          await ctx.reply(message, mainMenu);
        } catch (error) {
          console.error(
            "Pro purchase cancellation failed:",
            error
          );

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

      await ctx.reply(
        "به منوی اصلی برگشتی.",
        mainMenu
      );
    }
  );

  bot.hears(
    /^(۱|۲|۳|۶|۱۲|1|2|3|6|12) ماهه$/,
    async (ctx) => {
      if (!purchaseFlow.has(ctx.from.id)) {
        return;
      }

      const duration = durationValues[
        String(ctx.message.text).trim()
      ];

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
            "⏳ یک درخواست خرید پرو از قبل ثبت شده و هنوز باز است.\n\n" +
              `🆔 شماره درخواست: ${result.request.id}\n` +
              "برای ادامه، منتظر بررسی درخواست قبلی بمان.",
            mainMenu
          );
          return;
        }

        const request = result.request;

        await ctx.reply(
          "✅ درخواست خرید پرو ثبت شد.\n\n" +
            `🆔 شماره درخواست: ${request.id}\n` +
            `⏳ مدت اشتراک: ${request.duration_months} ماه\n\n` +
            "درخواست از طریق پنل مدیریت بررسی می‌شود. پس از دریافت اطلاعات پرداخت، می‌توانی پرداخت کنی و رسید را برای ربات بفرستی.",
          mainMenu
        );
      } catch (error) {
        console.error(
          "Pro purchase request failed:",
          error
        );

        await ctx.reply(
          "❌ ثبت درخواست با خطا مواجه شد. لطفاً کمی بعد دوباره تلاش کن.",
          mainMenu
        );
      }
    }
  );

  bot.on("text", async (ctx, next) => {
    try {
      const text = String(
        ctx.message?.text || ""
      ).trim();

      if (isMenuText(text)) {
        return next();
      }

      const handled = await handleReceipt(
        ctx,
        "TEXT",
        text,
        null
      );

      if (handled) {
        return;
      }
    } catch (error) {
      console.error(
        "Pro text handler failed:",
        error
      );
    }

    return next();
  });

  bot.on("photo", async (ctx, next) => {
    try {
      const photos = ctx.message?.photo || [];
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
      console.error(
        "Pro photo handler failed:",
        error
      );
    }

    return next();
  });
}

module.exports = { createProHandler };
