function createProHandler({
  bot,
  mainMenu,
}) {
  bot.hears("⭐ زکا پرو", async (ctx) => {
    await ctx.reply(
      "⭐ زکا پرو\n\n" +
        "نسخه پرو امکانات بیشتری در اختیار شما قرار می‌دهد.\n\n" +
        "💎 پلن‌های ۱، ۲، ۳، ۶ و ۱۲ ماهه\n" +
        "🚀 محدودیت دانلود بیشتر\n" +
        "🎁 امکانات ویژه\n" +
        "⭐ شانس بیشتر در جوایز\n\n" +
        "بخش خرید پرو به‌زودی فعال می‌شود.",
      mainMenu
    );
  });
}

module.exports = {
  createProHandler,
};
