const { Telegraf } = require("telegraf");

const config = require("./config/app");
const { close } = require("./database/client");
const { register, shutdown } = require("./core/shutdown");
const { getOrCreateUser } = require("./services/user.service");
const { parseUrl } = require("./services/url.service");

let bot = null;

function createBot() {
  if (bot) {
    return bot;
  }

  if (!config.bot.token) {
    throw new Error("BOT_TOKEN is not configured");
  }

  bot = new Telegraf(config.bot.token);

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
          `🔗 لینک محتوای موردنظر را برای ربات ارسال کن.`
      );
    } catch (error) {
      console.error("Start handler failed:", error);

      await ctx.reply(
        "❌ در ثبت اطلاعات شما مشکلی پیش آمد.\nلطفاً دوباره تلاش کنید."
      );
    }
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      "📖 راهنما\n\n" +
        "🔗 لینک محتوای موردنظر را برای ربات ارسال کن.\n\n" +
        "ربات در حال آماده‌سازی سیستم دانلود است."
    );
  });

  bot.on("text", async (ctx) => {
    const text = ctx.message.text.trim();

    if (!text || text.startsWith("/")) {
      return;
    }

    const parsed = parseUrl(text);

    if (!parsed.valid) {
      await ctx.reply(
        "❌ لینک معتبر نیست.\n\n" +
          "یک لینک کامل مثل این ارسال کن:\n" +
          "https://www.instagram.com/..."
      );
      return;
    }

    if (!parsed.platform) {
      await ctx.reply(
        "⚠️ این لینک متعلق به پلتفرم‌های پشتیبانی‌شده نیست."
      );
      return;
    }

    await ctx.reply(
      `🔗 لینک دریافت شد.\n\n` +
        `📱 پلتفرم: ${parsed.platform}\n\n` +
        `⏳ سیستم دانلود این پلتفرم در حال آماده‌سازی است.`
    );
  });

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
