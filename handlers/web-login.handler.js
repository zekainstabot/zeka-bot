"use strict";

const {
  getOrCreateWebLoginCode,
  regenerateWebLoginCode,
} = require("../services/web-login.service");

function createWebLoginHandler({ bot }) {
  const { getOrCreateUser } = require("../services/user.service");

  bot.hears("🌐 اتصال به زکا مدیا", async (ctx) => {
    try {
      const user = await getOrCreateUser(ctx.from);
      const result = await getOrCreateWebLoginCode(user);

      if (result.existing) {
        await ctx.reply(
          "🌐 اتصال به زکا مدیا\n\n" +
          "برای حساب شما قبلاً کد اتصال ساخته شده است. همان کد قبلی همچنان معتبر است.\n\n" +
          "اگر کد را فراموش کرده‌ای، از دکمه «🔄 تغییر کد اتصال» استفاده کن تا کد قبلی باطل شود."
        );
        return;
      }

      await ctx.reply(
        "🌐 کد اتصال زکا مدیا\n\n" +
        `<code>${result.code}</code>\n\n` +
        "این کد را در صفحه ورود سایت وارد کن. برای ورودهای بعدی هم معتبر می‌ماند.\n" +
        "هرکس این کد را داشته باشد می‌تواند وارد حساب تو شود؛ محرمانه نگهش دار.",
        { parse_mode: "HTML" }
      );
    } catch (error) {
      console.error("Web login menu failed:", error);
      await ctx.reply("❌ ساخت کد اتصال انجام نشد. کمی بعد دوباره تلاش کن.");
    }
  });

  bot.hears("🔄 تغییر کد اتصال", async (ctx) => {
    try {
      const user = await getOrCreateUser(ctx.from);
      const code = await regenerateWebLoginCode(user);
      await ctx.reply(
        "🔐 کد اتصال جدید زکا مدیا\n\n" +
        `<code>${code}</code>\n\n` +
        "کد قبلی فوراً باطل شد. از این پس فقط کد جدید معتبر است.",
        { parse_mode: "HTML" }
      );
    } catch (error) {
      console.error("Web login code regeneration failed:", error);
      await ctx.reply("❌ تغییر کد اتصال انجام نشد. کمی بعد دوباره تلاش کن.");
    }
  });
}

module.exports = { createWebLoginHandler };
