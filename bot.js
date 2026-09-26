const { Telegraf } = require("telegraf");

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

function createBot() {
  if (bot) {
    return bot;
  }

  if (!config.bot.token) {
    throw new Error("BOT_TOKEN is not configured");
  }

  bot = new Telegraf(config.bot.token);

  setDeliveryBot(bot);

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
        "🔗 لینک محتوای موردنظر را برای ربات ارسال کن."
    );
  });

  bot.command("admin", handleAdminCommand);

  bot.on("text", async (ctx) => {
    const text = ctx.message.text.trim();

    if (!text || text.startsWith("/")) {
      return;
    }

    try {
      const user = await getOrCreateUser(ctx.from);
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
          `⏳ وضعیت: در صف پردازش`
      );
    } catch (error) {
      console.error("Download request failed:", error);

      if (error && error.code === "DUPLICATE_ACTIVE_REQUEST") {
        await ctx.reply(
          "⏳ این لینک در حال حاضر در صف پردازش است.\n\n" +
            "لطفاً صبر کن تا دانلود قبلی تمام شود."
        );
        return;
      }

      if (error && error.code === "PLATFORM_DISABLED") {
        await ctx.reply(
          `⚠️ دانلود از ${error.platform} در حال حاضر غیرفعال است.\n\n` +
            "لطفاً بعداً دوباره تلاش کن."
        );
        return;
      }

      await ctx.reply(
        "❌ ثبت درخواست انجام نشد.\nلطفاً دوباره تلاش کنید."
      );
    }
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
