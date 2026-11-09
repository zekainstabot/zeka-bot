"use strict";

const { Markup } = require("telegraf");
const {
  getOrCreateWebLoginCode,
  regenerateWebLoginCode,
} = require("../services/web-login.service");

const connectionMenu = Markup.keyboard([
  ["🔄 تغییر کد اتصال"],
  ["🔙 بازگشت"],
]).resize().persistent();

function createWebLoginHandler({ bot }) {
  const { getOrCreateUser } = require("../services/user.service");

  bot.hears("🌐 اتصال به زکا مدیا", async (ctx) => {
    try {
      const user = await getOrCreateUser(ctx.from);
      const result = await getOrCreateWebLoginCode(user);

      if (result.existing) {
        await ctx.reply(
          "🌐 اتصال به زکا مدیا\n\n" +
          "کد اختصاصی قبلاً برای حساب تو ساخته شده و همچنان معتبر است. همان کد ذخیره‌شده را در سایت وارد کن.\n\n" +
          "اگر کد را گم کرده‌ای، دکمه «🔄 تغییر کد اتصال» را بزن تا کد قبلی باطل و کد تازه ساخته شود.",
          connectionMenu
        );
        return;
      }

      await ctx.reply(
        "🌐 کد اختصاصی زکا مدیا\n\n" +
        `<code>${result.code}</code>\n\n` +
        "این کد را در صفحه ورود سایت وارد کن. برای ورودهای بعدی هم معتبر می‌ماند.\n" +
        "هرکس این کد را داشته باشد می‌تواند وارد حساب تو شود؛ محرمانه نگهش دار.",
        { parse_mode: "HTML", ...connectionMenu }
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
        { parse_mode: "HTML", ...connectionMenu }
      );
    } catch (error) {
      console.error("Web login code regeneration failed:", error);
      await ctx.reply("❌ تغییر کد اتصال انجام نشد. کمی بعد دوباره تلاش کن.");
    }
  });
}

module.exports = { createWebLoginHandler };
