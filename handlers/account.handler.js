function createAccountHandler({
  bot,
  mainMenu,
  accountMenu,
}) {
  const {
    getOrCreateUser,
  } = require("../services/user.service");

  const {
    getAccountSummary,
    getLevelProgress,
  } = require("../services/account.service");

  bot.hears("👤 حساب من", async (ctx) => {
    try {
      const user = await getOrCreateUser(ctx.from);
      const account = await getAccountSummary(user);

      const proStatus = account.isPro
        ? "⭐ فعال"
        : "❌ فعال نیست";

      await ctx.reply(
        "👤 حساب من\n\n" +
          `👤 نام: ${account.displayName || "ثبت نشده"}\n` +
          `🆔 شناسه: ${account.telegramUserId}\n\n` +
          `💳 اعتبار: ${account.credit}\n` +
          `🏆 سطح: ${account.level}\n` +
          `✨ XP: ${account.xp}\n` +
          `🔥 روزهای فعال متوالی: ${account.streakDays}\n\n` +
          `⭐ زکا پرو: ${proStatus}`,
        accountMenu
      );
    } catch (error) {
      console.error("Account menu failed:", error);
      await ctx.reply(
        "❌ دریافت اطلاعات حساب انجام نشد.\nلطفاً دوباره تلاش کنید.",
        mainMenu
      );
    }
  });

  bot.hears("📊 اعتبار من", async (ctx) => {
    try {
      const user = await getOrCreateUser(ctx.from);
      const account = await getAccountSummary(user);
      const credits = account.credits || {};

      await ctx.reply(
        "📊 اعتبار من\n\n" +
          `🔄 رول‌اور: ${credits.rollover || 0}\n` +
          `📅 اعتبار روزانه: ${credits.daily || 0}\n` +
          `👥 اعتبار دعوت: ${credits.referral || 0}\n` +
          `💳 اعتبار خریداری‌شده: ${credits.purchased || 0}\n` +
          `➕ سایر اعتبارها: ${credits.other || 0}\n\n` +
          `💰 مجموع اعتبار: ${account.credit}\n\n` +
          "ℹ️ مصرف اعتبار طبق اولویت سیستم زکا انجام می‌شود.",
        accountMenu
      );
    } catch (error) {
      console.error("Credit menu failed:", error);
      await ctx.reply(
        "❌ دریافت اعتبار انجام نشد.\nلطفاً دوباره تلاش کنید.",
        mainMenu
      );
    }
  });

  bot.hears("🏆 سطح و XP", async (ctx) => {
    try {
      const user = await getOrCreateUser(ctx.from);
      const account = await getAccountSummary(user);
      const progress = await getLevelProgress(user);

      const barLength = 10;
      const filled = Math.round(
        (progress.progressPercent / 100) * barLength
      );
      const progressBar =
        "🟩".repeat(filled) +
        "⬜".repeat(barLength - filled);

      const nextLevelText = progress.nextLevel
        ? `🎯 سطح بعدی: ${progress.nextLevel.title} (سطح ${progress.nextLevel.level})\n` +
          `✨ امتیاز باقی‌مانده: ${progress.xpRemaining} XP\n` +
          `📈 پیشرفت: ${progress.xpIntoLevel} از ${progress.xpForLevel} XP\n` +
          `${progressBar} ${progress.progressPercent}%`
        : "👑 به بالاترین سطح فعلی رسیده‌ای!";

      const history = progress.recentTransactions.length
        ? progress.recentTransactions
            .map((item) => {
              const amount = Number(item.amount || 0);
              const sign = amount > 0 ? "+" : "";
              const description =
                item.description ||
                item.source_type ||
                "دریافت XP";
              return `• ${description}: ${sign}${amount} XP`;
            })
            .join("\n")
        : "هنوز امتیاز XP دریافت نکرده‌ای.";

      await ctx.reply(
        "🏆 سطح و XP\n\n" +
          `${progress.currentLevel.badge} عنوان: ${progress.currentLevel.title}\n` +
          `🏅 سطح فعلی: ${progress.currentLevel.level}\n` +
          `✨ مجموع XP: ${account.xp}\n` +
          `🔥 روزهای فعال متوالی: ${account.streakDays}\n\n` +
          `${nextLevelText}\n\n` +
          "🧾 آخرین تغییرات XP:\n" +
          history +
          "\n\n🎮 با پاسخ صحیح در مسابقه‌ها و دریافت جایزه XP از گردونه، امتیازت را افزایش بده.",
        accountMenu
      );
    } catch (error) {
      console.error("XP menu failed:", error);
      await ctx.reply(
        "❌ دریافت اطلاعات سطح و XP انجام نشد.\nلطفاً دوباره تلاش کنید.",
        mainMenu
      );
    }
  });

  bot.hears("🌐 زبان", async (ctx) => {
    await ctx.reply(
      "🌐 زبان\n\n" +
        `زبان فعلی حساب شما: ${ctx.from.language_code || "fa"}\n\n` +
        "بخش انتخاب زبان در مرحله بعد تکمیل می‌شود.",
      accountMenu
    );
  });

  bot.hears("👤 اطلاعات حساب", async (ctx) => {
    try {
      const user = await getOrCreateUser(ctx.from);
      const account = await getAccountSummary(user);

      await ctx.reply(
        "👤 اطلاعات حساب\n\n" +
          `👤 نام: ${account.displayName || "ثبت نشده"}\n` +
          `🔹 نام کاربری: ${account.username ? "@" + account.username : "ثبت نشده"}\n` +
          `🆔 شناسه تلگرام: ${account.telegramUserId}\n` +
          `🏆 سطح: ${account.level}\n` +
          `✨ XP: ${account.xp}\n` +
          `⭐ زکا پرو: ${account.isPro ? "فعال" : "فعال نیست"}`,
        accountMenu
      );
    } catch (error) {
      console.error("Account information failed:", error);
      await ctx.reply(
        "❌ دریافت اطلاعات حساب انجام نشد.\nلطفاً دوباره تلاش کنید.",
        mainMenu
      );
    }
  });
}

module.exports = {
  createAccountHandler,
};
