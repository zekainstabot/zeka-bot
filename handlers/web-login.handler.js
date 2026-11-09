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
          "برای این حساب قبلاً یک کد دائمی ساخته شده است. همان کد قبلی را در سایت وارد کن؛ لازم نیست برای هر ورود کد تازه بگیری.\n\n" +
          "اگر کد را ذخیره نکرده‌ای یا گمش کرده‌ای، «🔄 تغییر کد اتصال» را بزن. با این کار کد قبلی فوراً باطل می‌شود.",
          connectionMenu
        );
        return;
      }

      await ctx.reply(
        "🌐 کد اختصاصی زکا مدیا\n\n" +
        `<code>${result.code}</code>\n\n` +
        "این کد ثابت است و برای ورودهای بعدی هم استفاده می‌شود. آن را در سایت وارد کن و در جای امن نگه دار.\n\n" +
        "هرکس این کد را داشته باشد می‌تواند وارد حساب تو شود؛ آن را برای هیچ‌کس نفرست.",
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
