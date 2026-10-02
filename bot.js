const { Telegraf } = require("telegraf");

const {
  mainMenu,
  accountMenu,
  gamesMenu,
} = require("./config/bot-menus");

const config = require("./config/app");

const {
  close,
} = require("./database/client");

const {
  register,
  shutdown,
} = require("./core/shutdown");

const {
  getOrCreateUser,
} = require("./services/user.service");

const {
  parseUrl,
} = require("./services/url.service");

const {
  createDownloadRequest,
} = require("./services/request.service");

const {
  setBot: setDeliveryBot,
} = require("./services/delivery.service");

const {
  createBasicHandler,
} = require("./handlers/basic.handler");

const {
  createAccountHandler,
} = require("./handlers/account.handler");

const {
  createGamesHandler,
} = require("./handlers/games.handler");

const {
  createGiftsHandler,
} = require("./handlers/gifts.handler");

const {
  createProHandler,
} = require("./handlers/pro.handler");

const {
  createAdminHandler,
} = require("./handlers/admin.handler");

const {
  createQuizHandler,
  cleanupQuizTimers,
} = require("./games/quiz/quiz.handler");

const {
  recoverJobs,
} = require("./services/queue-recovery.service");

const {
  recoverDeliveredJobs,
} = require("./services/delivery-recovery.service");

let bot = null;

function createBot() {
  if (bot) {
    return bot;
  }

  if (!config.bot.token) {
    throw new Error("BOT_TOKEN is not configured");
  }

  bot = new Telegraf(config.bot.token);

  setDeliveryBot(bot);

  createQuizHandler({
    bot,
    gamesMenu,
  });

  createAdminHandler(bot);

  createBasicHandler({
    bot,
    mainMenu,
  });

  createAccountHandler({
    bot,
    mainMenu,
    accountMenu,
  });

  createGamesHandler({
    bot,
    gamesMenu,
  });

  createGiftsHandler({
    bot,
    mainMenu,
  });

  createProHandler({
    bot,
    mainMenu,
  });

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

  bot.hears("🔙 بازگشت", async (ctx) => {
    await ctx.reply(
      "🏠 منوی اصلی",
      mainMenu
    );
  });

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

  register(async () => {
    cleanupQuizTimers();

    if (bot) {
      await bot.stop(
        "shutdown"
      );
    }
  });

  register(async () => {
    await close();
  });

  return bot;
}

process.once(
  "SIGINT",
  async () => {
    await shutdown("SIGINT");
  }
);

process.once(
  "SIGTERM",
  async () => {
    await shutdown("SIGTERM");
  }
);

async function startBot() {
  const telegramBot =
    createBot();

  console.log(
    "Starting delivery recovery..."
  );

  await recoverDeliveredJobs();

  console.log(
    "Delivery recovery finished."
  );

  console.log(
    "Starting queue recovery..."
  );

  await recoverJobs();

  console.log(
    "Queue recovery finished."
  );

  await telegramBot.launch();

  console.log(
    "Telegram bot started."
  );
}

module.exports = {
  createBot,
  startBot,
};
