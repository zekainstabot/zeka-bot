function createBasicHandler({
  bot,
  mainMenu,
}) {
  bot.start(async (ctx) => {
    try {
      const { getOrCreateUser } = require("../services/user.service");

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

  bot.help(async (ctx) => {
    await ctx.reply(
      "📚 راهنمای زکا\n\n" +
        "🔗 برای دانلود، فقط لینک محتوا را ارسال کن.\n\n" +
        "زکا به‌صورت خودکار نوع محتوا و پلتفرم را تشخیص می‌دهد.\n\n" +
        "برای دسترسی به بخش‌های مختلف هم می‌توانی از منوی پایین استفاده کنی.",
      mainMenu
    );
  });

  bot.hears("📥 دانلود", async (ctx) => {
    await ctx.reply(
      "📥 دانلود\n\n" +
        "لینک محتوایی که می‌خواهی دانلود شود را ارسال کن.\n\n" +
        "مثال:\n" +
        "https://www.instagram.com/...",
      mainMenu
    );
  });
}

module.exports = {
  createBasicHandler,
};
