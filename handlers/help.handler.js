function createHelpHandler({
  bot,
  mainMenu,
}) {
  bot.hears("📚 راهنما", async (ctx) => {
    await ctx.reply(
      "📚 راهنمای استفاده از زکا\n\n" +
        "1️⃣ لینک محتوای موردنظر را ارسال کن.\n\n" +
        "2️⃣ زکا پلتفرم و نوع محتوا را تشخیص می‌دهد.\n\n" +
        "3️⃣ درخواست وارد صف پردازش می‌شود.\n\n" +
        "4️⃣ پس از آماده شدن فایل، آن را برایت ارسال می‌کنیم.\n\n" +
        "💡 لازم نیست نوع محتوا را دستی انتخاب کنی.",
      mainMenu
    );
  });
}

module.exports = {
  createHelpHandler,
};
