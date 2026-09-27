const { Telegraf, Markup } = require("telegraf");

const config = require("./config/app");
const { close } = require("./database/client");
const { register, shutdown } = require("./core/shutdown");
const { getOrCreateUser } = require("./services/user.service");
const { parseUrl } = require("./services/url.service");
const {
  createDownloadRequest,
} = require("./services/request.service");
const {
  setBot: setDeliveryBot,
} = require("./services/delivery.service");
const {
  handleAdminCommand,
} = require("./handlers/admin.handler");

let bot = null;

const mainMenu = Markup.keyboard([
  ["📥 دانلود", "👤 حساب من"],
  ["🎁 هدایا", "⭐ زکا پرو"],
  ["🛠 امکانات ویژه", "📚 راهنما"],
])
  .resize()
  .persistent();

function createBot() {
  if (bot) {
    return bot;
  }

  if (!config.bot.token) {
    throw new Error("BOT_TOKEN is not configured");
  }

  bot = new Telegraf(config.bot.token);

  setDeliveryBot(bot);

  // =========================
  // START
  // =========================

  bot.start(async (ctx) => {
    try {
      const user = await getOrCreateUser(ctx.from);

      const name =
        user.display_name ||
        user.username ||
        ctx.from.first_name ||
        "دوست";

      await ctx.reply(
        `سلام ${name} 👋\n\n` +
          `به زکا خوش آمدی.\n\n` +
          `🔗 برای دانلود، فقط لینک محتوای موردنظرت رو همینجا ارسال کن.`,
        mainMenu
      );
    } catch (error) {
      console.error("Start handler failed:", error);

      await ctx.reply(
        "❌ در ثبت اطلاعات شما مشکلی پیش آمد.\nلطفاً دوباره تلاش کنید."
      );
    }
  });

  // =========================
  // HELP
  // =========================

  bot.help(async (ctx) => {
    await ctx.reply(
      "📚 راهنمای زکا\n\n" +
        "🔗 برای دانلود، فقط لینک محتوا را ارسال کن.\n\n" +
        "زکا به‌صورت خودکار نوع محتوا و پلتفرم را تشخیص می‌دهد.\n\n" +
        "برای دسترسی به بخش‌های مختلف هم می‌توانی از منوی پایین استفاده کنی.",
      mainMenu
    );
  });

  // =========================
  // DOWNLOAD BUTTON
  // =========================

  bot.hears("📥 دانلود", async (ctx) => {
    await ctx.reply(
      "📥 دانلود\n\n" +
        "لینک محتوایی که می‌خواهی دانلود شود را ارسال کن.\n\n" +
        "مثال:\n" +
        "https://www.instagram.com/...",
      mainMenu
    );
  });

  // =========================
  // ACCOUNT
  // =========================

  bot.hears("👤 حساب من", async (ctx) => {
    await ctx.reply(
      "👤 حساب من\n\n" +
        "این بخش در حال تکمیل است.\n\n" +
        "به‌زودی اطلاعات حساب، اعتبار، سطح و زبان از این قسمت قابل مدیریت خواهد بود.",
      mainMenu
    );
  });

  // =========================
  // GIFTS
  // =========================

  bot.hears("🎁 هدایا", async (ctx) => {
    await ctx.reply(
      "🎁 هدایا\n\n" +
        "به‌زودی بخش‌های زیر در این قسمت قرار می‌گیرند:\n\n" +
        "👥 دعوت دوستان\n" +
        "🎰 شانس\n" +
        "🎯 مأموریت‌ها\n" +
        "➕ درخواست اعتبار بیشتر",
      mainMenu
    );
  });

  // =========================
  // PRO
  // =========================

  bot.hears("⭐ زکا پرو", async (ctx) => {
    await ctx.reply(
      "⭐ زکا پرو\n\n" +
        "نسخه پرو امکانات بیشتری در اختیار شما قرار می‌دهد.\n\n" +
        "💎 پلن‌های ۱، ۲، ۳، ۶ و ۱۲ ماهه\n" +
        "🚀 محدودیت دانلود بیشتر\n" +
        "🎁 امکانات ویژه\n" +
        "⭐ شانس بیشتر در جوایز\n\n" +
        "بخش خرید پرو به‌زودی فعال می‌شود.",
      mainMenu
    );
  });

  // =========================
  // SPECIAL FEATURES
  // =========================

  bot.hears("🛠 امکانات ویژه", async (ctx) => {
    await ctx.reply(
      "🛠 امکانات ویژه\n\n" +
        "این بخش برای امکانات پیشرفته زکا در نظر گرفته شده است.\n\n" +
        "📊 اطلاعات صفحات\n" +
        "📦 آرشیو صفحات عمومی\n" +
        "🎵 دانلود صوت\n" +
        "👀 مانیتور صفحات\n" +
        "📥 دانلود محتوای بیشتر\n\n" +
        "این امکانات به‌مرور فعال می‌شوند.",
      mainMenu
    );
  });

  // =========================
  // GUIDE
  // =========================

  bot.hears("📚 راهنما", async (ctx) => {
    await ctx.reply(
      "📚 راهنمای استفاده از زکا\n\n" +
        "1️⃣ لینک محتوای موردنظر را ارسال کن.\n\n" +
        "2️⃣ زکا پلتفرم و نوع محتوا را تشخیص می‌دهد.\n\n" +
        "3️⃣ درخواست وارد صف پردازش می‌شود.\n\n" +
        "4️⃣ پس از آماده شدن فایل، آن را برایت ارسال می‌کنیم.\n\n" +
        "💡 لازم نیست نوع محتوا را دستی انتخاب کنی.",
      mainMenu
    );
  });

  // =========================
  // ADMIN
  // =========================

  bot.command("admin", handleAdminCommand);

  // =========================
  // TEXT / DOWNLOAD REQUEST
  // =========================

  bot.on("text", async (ctx) => {
    const text = ctx.message.text.trim();

    if (!text || text.startsWith("/")) {
      return;
    }

    // دکمه‌های منو قبلاً توسط hears پردازش شده‌اند
    const menuButtons = [
      "📥 دانلود",
      "👤 حساب من",
      "🎁 هدایا",
      "⭐ زکا پرو",
      "🛠 امکانات ویژه",
      "📚 راهنما",
    ];

    if (menuButtons.includes(text)) {
      return;
    }

    try {
      const user = await getOrCreateUser(ctx.from);

      const parsed = parseUrl(text);

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

      const result = await createDownloadRequest({
        userId: user.id,
        platform: parsed.platform,
        originalUrl: text,
        normalizedUrl: parsed.url,
        contentType: parsed.contentType,
      });

      const request = result.request;
      const job = result.job;

      await ctx.reply(
        `✅ درخواست شما ثبت شد.\n\n` +
          `🆔 درخواست: ${request.request_id}\n` +
          `⚙️ وظیفه: ${job.job_id}\n` +
          `📱 پلتفرم: ${request.platform}\n` +
          `⏳ وضعیت: در صف پردازش`,
        mainMenu
      );
    } catch (error) {
      console.error("Download request failed:", error);

      if (error && error.code === "DUPLICATE_ACTIVE_REQUEST") {
        await ctx.reply(
          "⏳ این لینک در حال حاضر در صف پردازش است.\n\n" +
            "لطفاً صبر کن تا دانلود قبلی تمام شود.",
          mainMenu
        );
        return;
      }

      if (error && error.code === "PLATFORM_DISABLED") {
        await ctx.reply(
          `⚠️ دانلود از ${error.platform} در حال حاضر غیرفعال است.\n\n` +
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

  // =========================
  // SHUTDOWN
  // =========================

  register(async () => {
    if (bot) {
      await bot.stop("shutdown");
    }
  });

  register(async () => {
    await close();
  });

  return bot;
}

process.once("SIGINT", async () => {
  await shutdown("SIGINT");
});

process.once("SIGTERM", async () => {
  await shutdown("SIGTERM");
});

async function startBot() {
  const telegramBot = createBot();

  await telegramBot.launch();

  console.log("Telegram bot started.");
}

module.exports = {
  createBot,
  startBot,
};
