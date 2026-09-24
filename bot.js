const { Telegraf } = require("telegraf");

const config = require("./config/app");
const { close } = require("./database/client");
const { register, shutdown } = require("./core/shutdown");

if (!config.bot.token) {
  throw new Error("BOT_TOKEN is not configured");
}

const bot = new Telegraf(config.bot.token);

bot.start(async (ctx) => {
  await ctx.reply(
    "سلام 👋\n\nبه زکا خوش آمدی.\nربات آماده دریافت لینک است."
  );
});

bot.help(async (ctx) => {
  await ctx.reply(
    "📖 راهنما\n\nلینک محتوای موردنظر را برای ربات ارسال کن."
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
