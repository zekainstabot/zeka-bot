const { Telegraf } = require("telegraf");

const config = require("./config/app");
const { close } = require("./database/client");
const { register, shutdown } = require("./core/shutdown");
const { getOrCreateUser } = require("./services/user.service");

if (!config.bot.token) {
  throw new Error("BOT_TOKEN is not configured");
}

const bot = new Telegraf(config.bot.token);

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

register(async () => {
  await bot.stop("shutdown");
});

register(async () => {
  await close();
});

process.once("SIGINT", async () => {
  await shutdown("SIGINT");
});

process.once("SIGTERM", async () => {
  await shutdown("SIGTERM");
});

async function startBot() {
  await bot.launch();

  console.log("Telegram bot started.");
}

module.exports = {
  bot,
  startBot,
};
