function createFeaturesHandler({
  bot,
  mainMenu,
}) {
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
}

module.exports = {
  createFeaturesHandler,
};
