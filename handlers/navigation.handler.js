function createNavigationHandler({
  bot,
  mainMenu,
}) {
  bot.hears("🔙 بازگشت", async (ctx) => {
    await ctx.reply(
      "🏠 منوی اصلی",
      mainMenu
    );
  });
}

module.exports = {
  createNavigationHandler,
};
