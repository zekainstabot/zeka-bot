"use strict";

function createNavigationHandler({
  bot,
  mainMenu,
}) {
  bot.hears("🔙 بازگشت", async (ctx) => {
    // The generic back action always returns to the persistent main keyboard.
    await ctx.reply("🏠 منوی اصلی", mainMenu);
  });
}

module.exports = {
  createNavigationHandler,
};
