function createDownloadHandler({
  bot,
  mainMenu,
}) {
  const {
    getOrCreateUser,
  } = require("../services/user.service");

  const {
    parseUrl,
  } = require("../services/url.service");

  const {
    createDownloadRequest,
  } = require("../services/request.service");

  bot.on("text", async (ctx) => {
    const text =
      ctx.message.text.trim();

    if (
      !text ||
      text.startsWith("/")
    ) {
      return;
    }

    const menuButtons = [
      "📥 دانلود",
      "👤 حساب من",
      "🎁 هدایا",
      "⭐ زکا پرو",
      "🎮 مینی‌گیم‌ها",
      "🎡 گردونه شانس",
      "🧠 مسابقه",
      "❌ لغو مسابقه",
      "🛠 امکانات ویژه",
      "📚 راهنما",
      "📊 اعتبار من",
      "🏆 سطح و XP",
      "🌐 زبان",
      "👤 اطلاعات حساب",
      "🔙 بازگشت",

      "🧠 مدیریت مسابقه",
      "➕ افزودن سؤال",
      "🔙 پنل مدیریت",
      "🔙 خروج از پنل مدیریت",
      "❌ لغو",
    ];

    if (menuButtons.includes(text)) {
      return;
    }

    try {
      const user =
        await getOrCreateUser(
          ctx.from
        );

      const parsed =
        parseUrl(text);

      if (!parsed.valid) {
        await ctx.reply(
          "❌ لینک معتبر نیست.\n\n" +
            "یک لینک کامل مثل این ارسال کن:\n" +
            "https://www.instagram.com/...",
          mainMenu
        );

        return;
      }

      if (!parsed.platform) {
        await ctx.reply(
          "⚠️ این لینک متعلق به پلتفرم‌های پشتیبانی‌شده نیست.",
          mainMenu
        );

        return;
      }

      const result =
        await createDownloadRequest({
          userId: user.id,
          platform: parsed.platform,
          originalUrl: text,
          normalizedUrl: parsed.url,
          contentType:
            parsed.contentType,
        });

      const request =
        result.request;

      const job =
        result.job;

      await ctx.reply(
        `✅ درخواست شما ثبت شد.\n\n` +
          `🆔 درخواست: ${request.request_id}\n` +
          `⚙️ وظیفه: ${job.job_id}\n` +
          `📱 پلتفرم: ${request.platform}\n` +
          `⏳ وضعیت: در صف پردازش`,
        mainMenu
      );
    } catch (error) {
      console.error(
        "Download request failed:",
        error
      );

      if (
        error &&
        error.code ===
          "DUPLICATE_ACTIVE_REQUEST"
      ) {
        await ctx.reply(
          "⏳ این لینک در حال حاضر در صف پردازش است.\n\n" +
            "لطفاً صبر کن تا دانلود قبلی تمام شود.",
          mainMenu
        );

        return;
      }

      if (
        error &&
        error.code ===
          "PLATFORM_DISABLED"
      ) {
        await ctx.reply(
          `⚠️ دانلود از ${
            error.platform
          } در حال حاضر غیرفعال است.\n\n` +
            "لطفاً بعداً دوباره تلاش کن.",
          mainMenu
        );

        return;
      }

      await ctx.reply(
        "❌ ثبت درخواست انجام نشد.\nلطفاً دوباره تلاش کنید.",
        mainMenu
      );
    }
  });
}

module.exports = {
  createDownloadHandler,
};
