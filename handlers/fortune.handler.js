const {
  fortuneMenu,
} = require("../config/bot-menus");

const fortuneService = require(
  "../services/fortune.service"
);

const FORTUNE_TYPES = {
  "📖 فال حافظ": "hafez",
  "❤️ فال عشق": "love",
  "🌙 فال روزانه": "daily",
  "💰 فال مالی": "money",
  "🎯 فال نیت": "intention",
};

async function showFortune(
  ctx,
  slug,
  label
) {
  try {
    const category =
      await fortuneService.getCategoryBySlug(
        slug
      );

    if (!category) {
      await ctx.reply(
        "❌ این نوع فال پیدا نشد.",
        fortuneMenu
      );
      return;
    }

    const fortune =
      await fortuneService.getRandomFortune(
        category.id
      );

    if (!fortune) {
      await ctx.reply(
        "⏳ این بخش هنوز فال ثبت‌شده ندارد.",
        fortuneMenu
      );
      return;
    }

    const title =
      fortune.title || label;

    const sourceNumber =
      fortune.source_number
        ? `\n🔢 شماره: ${fortune.source_number}`
        : "";

    await ctx.reply(
      `${title}${sourceNumber}\n\n` +
        `${fortune.content}\n\n` +
        "🔮 برای دریافت یک فال دیگر، دوباره همین گزینه را بزن.",
      fortuneMenu
    );
  } catch (error) {
    console.error(
      "Fortune request failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت فال انجام نشد. لطفاً دوباره تلاش کن.",
      fortuneMenu
    );
  }
}

function createFortuneHandler({
  bot,
}) {
  bot.hears(
    "🔮 فال",
    async (ctx) => {
      await ctx.reply(
        "🔮 فال\n\n" +
          "نوع فال موردنظرت را انتخاب کن:",
        fortuneMenu
      );
    }
  );

  for (
    const [label, slug] of Object.entries(
      FORTUNE_TYPES
    )
  ) {
    bot.hears(
      label,
      async (ctx) => {
        await showFortune(
          ctx,
          slug,
          label
        );
      }
    );
  }
}

module.exports = {
  createFortuneHandler,
};
