
const { Markup } = require("telegraf");

const {
  createPurchaseRequest,
  getProManagers,
  ALLOWED_DURATIONS,
} = require("../services/pro-purchase.service");

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

function createProHandler({ bot, mainMenu }) {
  bot.hears("⭐ زکا پرو", async (ctx) => {
    purchaseFlow.set(ctx.from.id, true);

    await ctx.reply(
      "⭐ زکا پرو\n\n" +
        "با خرید پرو می‌توانی از امکانات ویژهٔ زکا استفاده کنی.\n\n" +
        "🚀 امکانات بیشتر\n" +
        "💎 انتخاب مدت اشتراک\n" +
        "🎁 امکانات ویژهٔ پرو\n\n" +
        "مدت اشتراک موردنظرت را انتخاب کن. پس از ثبت درخواست، ادمین برای هماهنگی خرید و فعال‌سازی پیگیری می‌کند.",
      durationKeyboard
    );
  });

  bot.hears(
    ["🔙 بازگشت", "❌ لغو درخواست"],
    async (ctx, next) => {
      if (!purchaseFlow.has(ctx.from.id)) {
        return next();
      }

      purchaseFlow.delete(ctx.from.id);

      await ctx.reply(
        "درخواست خرید پرو لغو شد.",
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
                  request.username
                    ? "@" + request.username
                    : "ندارد"
                }\n` +
                `🆔 شناسه تلگرام: ${request.telegram_user_id}\n` +
                `⏳ مدت اشتراک: ${request.duration_months} ماه\n\n` +
                "پس از دریافت وجه، از پنل Super Admin و بخش مدیریت Pro، اشتراک کاربر را دستی فعال کن."
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
              `شماره درخواست: ${request.id}\n` +
              "لطفاً با پشتیبانی تماس بگیر.",
            mainMenu
          );
          return;
        }

        await ctx.reply(
          "✅ درخواست خرید پرو ثبت شد.\n\n" +
            `🆔 شماره درخواست: ${request.id}\n` +
            `⏳ مدت اشتراک: ${request.duration_months} ماه\n\n` +
            "درخواست برای ادمین ارسال شد. پس از هماهنگی پرداخت، اشتراک به‌صورت دستی فعال می‌شود.",
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
}

module.exports = { createProHandler };
