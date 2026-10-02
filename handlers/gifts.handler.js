function createGiftsHandler({
  bot,
  mainMenu,
}) {
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
}

module.exports = {
  createGiftsHandler,
};
