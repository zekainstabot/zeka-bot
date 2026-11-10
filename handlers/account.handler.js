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

  function getProRemainingText(account, language = "fa") {
    if (!account.isPro) {
      return language === "en" ? "Not active" : "فعال نیست";
    }

    if (!account.proExpiresAt) {
      return language === "en" ? "Active (no expiry date)" : "فعال (بدون تاریخ انقضا)";
    }

    const remainingMs = new Date(account.proExpiresAt).getTime() - Date.now();
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
      return language === "en" ? "Expired" : "منقضی شده";
    }

    const totalHours = Math.ceil(remainingMs / (60 * 60 * 1000));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const remaining = language === "en"
      ? [days ? `${days} day(s)` : "", hours ? `${hours} hour(s)` : ""].filter(Boolean).join(" and ") || "Less than an hour"
      : [days ? `${days} روز` : "", hours ? `${hours} ساعت` : ""].filter(Boolean).join(" و ") || "کمتر از یک ساعت";
    const expiry = new Date(account.proExpiresAt).toLocaleString(language === "en" ? "en-GB" : "fa-IR", {
      timeZone: "Asia/Tehran",
      dateStyle: "medium",
      timeStyle: "short",
    });

    return language === "en"
      ? `${remaining} remaining (expires: ${expiry})`
      : `${remaining} باقی‌مانده (تاریخ انقضا: ${expiry})`;
  }

  bot.hears("👤 حساب من", async (ctx) => {
    try {
      const user = await getOrCreateUser(ctx.from);
      const account = await getAccountSummary(user);

      const language = account.language || ctx.state?.language || "fa";
      const proStatus = account.isPro
        ? "⭐ فعال"
        : "❌ فعال نیست";
      const proRemaining = getProRemainingText(account, language);

      await ctx.reply(
        "👤 حساب من\n\n" +
          `👤 نام: ${account.displayName || "ثبت نشده"}\n` +
          `🆔 شناسه: ${account.telegramUserId}\n\n` +
          `💳 اعتبار: ${account.credit}\n` +
          `📕 بدهی: ${account.debt || 0} اعتبار\n` +
          `🏆 سطح: ${account.level}\n` +
          `✨ XP: ${account.xp}\n` +
          `🔥 روزهای فعال متوالی: ${account.streakDays}\n\n` +
          `⭐ زکا پرو: ${proStatus}\n` +
          `⏳ مدت باقی‌مانده: ${proRemaining}`,
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
          `💰 مجموع اعتبار: ${account.credit}\n` +
          `📕 بدهی فعال: ${account.debt || 0} اعتبار\n\n` +
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

  const { setLanguage } = require("../services/language.service");
  const { Markup } = require("telegraf");

  bot.hears("🌐 زبان", async (ctx) => {
    await ctx.reply(
      "🌐 زبان\n\nزبان را انتخاب کنید:",
      Markup.inlineKeyboard([
        [Markup.button.callback("🇮🇷 فارسی", "language:set:fa")],
        [Markup.button.callback("🇬🇧 English", "language:set:en")],
      ])
    );
  });

  bot.action(/^language:set:(fa|en)$/, async (ctx) => {
    try {
      const language = ctx.match[1];
      await setLanguage(ctx.from.id, language);
      ctx.state.language = language;
      await ctx.answerCbQuery(language === "en" ? "Language updated" : "زبان تغییر کرد");
      await ctx.reply(
        language === "en"
          ? "Language changed to English. Use /start to refresh all menus."
          : "زبان با موفقیت به فارسی تغییر کرد. برای به‌روزرسانی منوها /start را بزن.",
        mainMenu
      );
    } catch (error) {
      console.error("Language update failed:", error);
      await ctx.answerCbQuery("Could not change language", { show_alert: true });
    }
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
          `⭐ زکا پرو: ${account.isPro ? "فعال" : "فعال نیست"}\n` +
          `⏳ مدت باقی‌مانده: ${getProRemainingText(account, account.language || ctx.state?.language || "fa")}`,
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
