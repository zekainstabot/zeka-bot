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
        ctx.state?.language === "en"
          ? "❌ This fortune category was not found."
          : "❌ این نوع فال پیدا نشد.",
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
        ctx.state?.language === "en"
          ? "⏳ There are no fortunes in this section yet."
          : "⏳ این بخش هنوز فال ثبت‌شده ندارد.",
        fortuneMenu
      );
      return;
    }

    const isEnglish =
      ctx.state?.language === "en";

    const useEnglishFortune =
      ["love", "hafez"].includes(slug) &&
      isEnglish &&
      fortune.content_en;

    const title =
      (useEnglishFortune
        ? fortune.title_en
        : fortune.title) ||
      (isEnglish && slug === "love"
        ? "❤️ Love Fortune"
        : isEnglish && slug === "hafez"
          ? "📖 Hafez Fortune"
          : label);

    const fortuneContent =
      useEnglishFortune
        ? fortune.content_en
        : fortune.content;

    const sourceNumber =
      fortune.source_number
        ? isEnglish
          ? `\n🔢 Number: ${fortune.source_number}`
          : `\n🔢 شماره: ${fortune.source_number}`
        : "";

    const footer =
      isEnglish
        ? "\n\n🔮 For another fortune, tap this button again.\n\nℹ️ For entertainment and reflection only; not a prediction."
        : "\n\n🔮 برای دریافت یک فال دیگر، دوباره همین گزینه را بزن.\n\nℹ️ این فال صرفاً برای سرگرمی و تأمل است و پیش‌بینی قطعی نیست.";

    await ctx.reply(
      `${title}${sourceNumber}\n\n` +
        `${fortuneContent}${footer}`,
      fortuneMenu
    );
  } catch (error) {
    console.error(
      "Fortune request failed:",
      error
    );

    await ctx.reply(
      ctx.state?.language === "en"
        ? "❌ Could not load the fortune. Please try again."
        : "❌ دریافت فال انجام نشد. لطفاً دوباره تلاش کن.",
      fortuneMenu
    );
  }
}

function createFortuneHandler({
  bot,
}) {
    const openFortuneMenu = async (ctx) => {
    await ctx.reply(
      ctx.state?.language === "en"
        ? "🔮 Fortune\n\nChoose the type of fortune you want:"
        : "🔮 فال\n\nنوع فال موردنظرت را انتخاب کن:",
      fortuneMenu
    );
  };

  bot.hears("🔮 فال", openFortuneMenu);
  bot.hears("📜 فال حافظ", openFortuneMenu);

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
