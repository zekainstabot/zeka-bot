
const { Markup } = require("telegraf");

const {
  getLatestOpenPurchaseRequest,
  submitPurchaseReceipt,
  ALLOWED_DURATIONS,
  cancelPurchaseRequest,
} = require("../services/pro-purchase.service");

const {
  getCheckoutQuote,
  createPricedPurchaseRequest,
} = require("../services/pro-checkout.service");

const purchaseFlow = new Map();

const durationKeyboard = Markup.keyboard([
  ["۱ ماهه", "۲ ماهه"],
  ["۳ ماهه", "۶ ماهه"],
  ["۱۲ ماهه"],
  ["🔙 بازگشت", "❌ لغو درخواست"],
])
  .resize()
  .persistent();

const checkoutKeyboard = Markup.keyboard([
  ["🎟️ وارد کردن کد تخفیف"],
  ["✅ ثبت درخواست خرید"],
  ["🔙 بازگشت", "❌ لغو درخواست"],
])
  .resize()
  .persistent();

const couponKeyboard = Markup.keyboard([
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
    "🎟️ وارد کردن کد تخفیف",
    "✅ ثبت درخواست خرید",
    "/start",
    "/help",
  ].includes(String(text || "").trim());
}

function formatToman(amount) {
  return (
    new Intl.NumberFormat("fa-IR", {
      maximumFractionDigits: 0,
    }).format(Number(amount || 0)) +
    " تومان"
  );
}

function couponErrorMessage(reason) {
  const messages = {
    INVALID_FORMAT: "فرمت کد تخفیف معتبر نیست.",
    NOT_FOUND: "این کد تخفیف وجود ندارد.",
    INACTIVE: "این کد تخفیف غیرفعال شده است.",
    NOT_STARTED: "زمان استفاده از این کد هنوز شروع نشده است.",
    EXPIRED: "مهلت استفاده از این کد تمام شده است.",
    LIMIT_REACHED: "ظرفیت استفاده از این کد تکمیل شده است.",
    ALREADY_USED: "قبلاً از این کد تخفیف استفاده کرده‌ای.",
  };

  return messages[reason] || "این کد تخفیف قابل استفاده نیست.";
}

function buildQuoteMessage(quote) {
  const lines = [
    "💎 پیش‌فاکتور خرید زکا پرو",
    "",
    `⏳ مدت اشتراک: ${quote.durationMonths} ماه`,
    `💰 قیمت پایه: ${formatToman(quote.basePriceAmount)}`,
  ];

  if (quote.planDiscountPercent > 0) {
    lines.push(
      `🎁 تخفیف مدت اشتراک: ${quote.planDiscountPercent}٪`
    );
  }

  if (quote.extraDiscountPercent > 0) {
    lines.push(
      `⭐ تخفیف عمومی: ${quote.extraDiscountPercent}٪`
    );
  }

  if (quote.couponCode) {
    lines.push(
      `🎟️ کد تخفیف: ${quote.couponCode}`,
      `🏷️ تخفیف کد: ${quote.couponDiscountPercent}٪`
    );
  }

  lines.push(
    "",
    `📉 تخفیف نهایی اعمال‌شده: ${quote.appliedDiscountPercent}٪`,
    `💳 مبلغ نهایی: ${formatToman(quote.priceAmount)}`,
    "",
    "برای ادامه، ثبت درخواست خرید را انتخاب کن."
  );

  return lines.join("\n");
}

async function showCheckout(ctx, state) {
  const quote = await getCheckoutQuote({
    durationMonths: state.durationMonths,
    telegramUserId: ctx.from.id,
    couponCode: state.couponCode || null,
  });

  if (!quote.valid) {
    state.couponCode = null;
    state.step = "checkout";

    purchaseFlow.set(ctx.from.id, state);

    await ctx.reply(
      couponErrorMessage(quote.reason),
      checkoutKeyboard
    );

    return;
  }

  state.step = "checkout";
  state.quote = quote;

  purchaseFlow.set(ctx.from.id, state);

  await ctx.reply(
    buildQuoteMessage(quote),
    checkoutKeyboard
  );
}

async function submitCheckout(ctx) {
  const state = purchaseFlow.get(ctx.from.id);

  if (!state || state.step !== "checkout") {
    return;
  }

  try {
    const result = await createPricedPurchaseRequest({
      telegramUserId: ctx.from.id,
      username: ctx.from.username,
      displayName: [
        ctx.from.first_name,
        ctx.from.last_name,
      ]
        .filter(Boolean)
        .join(" "),
      durationMonths: state.durationMonths,
      couponCode: state.couponCode || null,
    });

    purchaseFlow.delete(ctx.from.id);

    if (result.alreadyPending) {
      await ctx.reply(
        "⏳ یک درخواست خرید پرو از قبل ثبت شده و هنوز باز است.\n\n" +
          `🆔 شماره درخواست: ${result.request.id}\n` +
          "برای ادامه، منتظر بررسی درخواست قبلی بمان."
      );

      return;
    }

    const request = result.request;

    await ctx.reply(
      "✅ درخواست خرید پرو ثبت شد.\n\n" +
        `🆔 شماره درخواست: ${request.id}\n` +
        `⏳ مدت اشتراک: ${request.duration_months} ماه\n` +
        `💰 مبلغ قابل پرداخت: ${formatToman(request.price_amount)}\n` +
        (request.coupon_code
          ? `🎟️ کد تخفیف: ${request.coupon_code}\n`
          : "") +
        "\nدرخواست از طریق پنل مدیریت بررسی می‌شود. پس از دریافت اطلاعات پرداخت، پرداخت را انجام بده و رسید را برای ربات بفرست."
    );
  } catch (error) {
    console.error(
      "Pro checkout submission failed:",
      error
    );

    if (
      error.code === "COUPON_UNAVAILABLE" ||
      error.code === "COUPON_ALREADY_USED"
    ) {
      state.step = "checkout";
      state.couponCode = null;

      purchaseFlow.set(ctx.from.id, state);

      await ctx.reply(
        "⚠️ کد تخفیف هنگام ثبت درخواست دیگر قابل استفاده نبود.\n" +
          "پیش‌فاکتور بدون کد تخفیف به‌روزرسانی شد."
      );

      try {
        await showCheckout(ctx, state);
      } catch (quoteError) {
        console.error(
          "Refreshing Pro checkout quote failed:",
          quoteError
        );

        await ctx.reply(
          "❌ دریافت مجدد قیمت انجام نشد. کمی بعد تلاش کن."
        );
      }

      return;
    }

    await ctx.reply(
      "❌ ثبت درخواست با خطا مواجه شد. کمی بعد دوباره تلاش کن."
    );
  }
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

  let updated;

  try {
    updated = await submitPurchaseReceipt({
      requestId: request.id,
      telegramUserId,
      receiptType,
      receiptText,
      receiptFileId,
    });
  } catch (error) {
    if (error.code === "DUPLICATE_RECEIPT") {
      await ctx.reply(
        "⚠️ این رسید قبلاً برای یک درخواست خرید ثبت شده است.\n\n" +
          "لطفاً رسید پرداخت معتبر و جدید ارسال کن."
      );

      return true;
    }

    throw error;
  }

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
    purchaseFlow.set(ctx.from.id, {
      step: "duration",
      durationMonths: null,
      couponCode: null,
      quote: null,
    });

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
    "🎟️ وارد کردن کد تخفیف",
    async (ctx) => {
      const state = purchaseFlow.get(ctx.from.id);

      if (!state || state.step !== "checkout") {
        return;
      }

      state.step = "coupon";

      purchaseFlow.set(ctx.from.id, state);

      await ctx.reply(
        "🎟️ کد تخفیف را ارسال کن.\n\n" +
          "برای لغو ورود کد، «🔙 بازگشت» را بزن.",
        couponKeyboard
      );
    }
  );

  bot.hears(
    "✅ ثبت درخواست خرید",
    submitCheckout
  );

  bot.hears(
    ["🔙 بازگشت", "❌ لغو درخواست"],
    async (ctx, next) => {
      const text = String(
        ctx.message?.text || ""
      ).trim();

      const state = purchaseFlow.get(ctx.from.id);

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

      if (!state) {
        return next();
      }

      if (state.step === "coupon") {
        state.step = "checkout";

        purchaseFlow.set(ctx.from.id, state);

        try {
          await showCheckout(ctx, state);
        } catch (error) {
          console.error(
            "Returning to Pro checkout failed:",
            error
          );

          await ctx.reply(
            "❌ دریافت پیش‌فاکتور انجام نشد. دوباره تلاش کن."
          );
        }

        return;
      }

      if (state.step === "checkout") {
        state.step = "duration";
        state.durationMonths = null;
        state.couponCode = null;
        state.quote = null;

        purchaseFlow.set(ctx.from.id, state);

        await ctx.reply(
          "مدت اشتراک را دوباره انتخاب کن.",
          durationKeyboard
        );

        return;
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
      const state = purchaseFlow.get(ctx.from.id);

      if (!state || state.step !== "duration") {
        return;
      }

      const duration = durationValues[
        String(ctx.message.text).trim()
      ];

      if (!ALLOWED_DURATIONS.includes(duration)) {
        return;
      }

      state.durationMonths = duration;
      state.couponCode = null;

      try {
        await showCheckout(ctx, state);
      } catch (error) {
        console.error(
          "Pro quote generation failed:",
          error
        );

        await ctx.reply(
          "❌ دریافت قیمت اشتراک انجام نشد. کمی بعد دوباره تلاش کن."
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

      const state = purchaseFlow.get(ctx.from?.id);

      if (state?.step === "coupon") {
        try {
          const quote = await getCheckoutQuote({
            durationMonths: state.durationMonths,
            telegramUserId: ctx.from.id,
            couponCode: text,
          });

          if (!quote.valid) {
            await ctx.reply(
              couponErrorMessage(quote.reason)
            );

            return;
          }

          state.couponCode = text
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "");

          state.step = "checkout";

          purchaseFlow.set(ctx.from.id, state);

          await showCheckout(ctx, state);
        } catch (error) {
          console.error(
            "Pro coupon validation failed:",
            error
          );

          await ctx.reply(
            "❌ بررسی کد تخفیف انجام نشد. دوباره تلاش کن."
          );
        }

        return;
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
