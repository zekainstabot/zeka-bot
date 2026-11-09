"use strict";

const { Markup } = require("telegraf");
const { getOrCreateUser } = require("../services/user.service");
const { redeemGiftCode, getUserRewards } = require("../services/gift.service");

const pendingGiftCode = new Set();

function giftsMenu() {
  return Markup.keyboard([
    ["🎟 ثبت کد هدیه"],
    ["🎁 جوایز دریافتی من"],
    ["🔙 بازگشت"]
  ]).resize().persistent();
}

function formatReward(item, language) {
  const date = new Date(item.created_at);
  const dateText = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(language === "en" ? "en-US" : "fa-IR");
  const parts = [];
  if (Number(item.credit_amount) > 0) parts.push(`+${Number(item.credit_amount)} ${language === "en" ? "credits" : "اعتبار"}`);
  if (Number(item.xp_amount) > 0) parts.push(`+${Number(item.xp_amount)} XP`);
  if (Number(item.pro_days) > 0) parts.push(`+${Number(item.pro_days)} ${language === "en" ? "Pro days" : "روز پرو"}`);
  return `• ${parts.join("، ") || (language === "en" ? "Reward" : "جایزه")} ${dateText ? "— " + dateText : ""}`;
}

function giftErrorMessage(error, language) {
  const fa = {
    INVALID_CODE: "کد واردشده معتبر نیست.",
    GIFT_NOT_FOUND: "این کد هدیه وجود ندارد.",
    GIFT_INACTIVE: "این کد هدیه غیرفعال شده است.",
    GIFT_NOT_STARTED: "زمان استفاده از این کد هنوز شروع نشده است.",
    GIFT_EXPIRED: "مهلت استفاده از این کد به پایان رسیده است.",
    GIFT_EXHAUSTED: "ظرفیت استفاده از این کد تکمیل شده است.",
    GIFT_ALREADY_USED: "قبلاً از این کد هدیه استفاده کرده‌ای.",
    GIFT_EMPTY: "این کد در حال حاضر جایزه‌ای ندارد.",
    GIFT_GRANT_FAILED: "ثبت جایزه انجام نشد. دوباره تلاش کن."
  };
  const en = {
    INVALID_CODE: "The gift code is invalid.",
    GIFT_NOT_FOUND: "This gift code does not exist.",
    GIFT_INACTIVE: "This gift code has been disabled.",
    GIFT_NOT_STARTED: "This gift code is not available yet.",
    GIFT_EXPIRED: "This gift code has expired.",
    GIFT_EXHAUSTED: "This gift code has reached its usage limit.",
    GIFT_ALREADY_USED: "You have already redeemed this gift code.",
    GIFT_EMPTY: "This gift code has no reward.",
    GIFT_GRANT_FAILED: "The reward could not be saved. Please try again."
  };
  const key = String(error?.message || "");
  return (language === "en" ? en : fa)[key] ||
    (language === "en" ? "Something went wrong while redeeming the code." : "هنگام ثبت کد هدیه خطایی رخ داد.");
}

function createGiftsHandler({ bot, mainMenu }) {
  bot.hears("🎁 هدایا", async (ctx) => {
    pendingGiftCode.delete(ctx.from.id);
    await ctx.reply(
      ctx.state?.language === "en"
        ? "🎁 Gifts\n\nRedeem a gift code or view the rewards you have received."
        : "🎁 هدایا\n\nکد هدیه‌ات را ثبت کن یا جایزه‌هایی را که دریافت کرده‌ای ببین.",
      giftsMenu()
    );
  });

  bot.hears("🎟 ثبت کد هدیه", async (ctx) => {
    pendingGiftCode.add(ctx.from.id);
    await ctx.reply(
      ctx.state?.language === "en"
        ? "🎟 Send your gift code in one message.\n\nYou can cancel using 🔙 Back."
        : "🎟 کد هدیه را در یک پیام بفرست.\n\nبرای لغو، «🔙 بازگشت» را بزن.",
      Markup.keyboard([["🔙 بازگشت"]]).resize().persistent()
    );
  });

  bot.hears("🎁 جوایز دریافتی من", async (ctx) => {
    try {
      const user = await getOrCreateUser(ctx.from);
      const rewards = await getUserRewards(user.id, 10);
      const language = ctx.state?.language || "fa";

      if (!rewards.length) {
        await ctx.reply(
          language === "en"
            ? "🎁 You have not received any rewards yet."
            : "🎁 هنوز جایزه‌ای دریافت نکرده‌ای.",
          giftsMenu()
        );
        return;
      }

      const lines = rewards.map((item) => formatReward(item, language));
      await ctx.reply(
        (language === "en" ? "🎁 Your latest rewards\n\n" : "🎁 آخرین جوایز دریافتی تو\n\n") +
          lines.join("\n"),
        giftsMenu()
      );
    } catch (error) {
      console.error("User reward history failed:", error);
      await ctx.reply(
        ctx.state?.language === "en"
          ? "Could not load your rewards. Please try again."
          : "دریافت فهرست جوایز انجام نشد. دوباره تلاش کن.",
        giftsMenu()
      );
    }
  });

  bot.hears("🔙 بازگشت", async (ctx, next) => {
    if (!pendingGiftCode.has(ctx.from.id)) return next();
    pendingGiftCode.delete(ctx.from.id);
    await ctx.reply(
      ctx.state?.language === "en" ? "Gift code entry cancelled." : "ثبت کد هدیه لغو شد.",
      giftsMenu()
    );
  });

  bot.on("text", async (ctx, next) => {
    if (!pendingGiftCode.has(ctx.from?.id)) return next();

    const code = String(ctx.message?.text || "").trim();
    if (!code || code.startsWith("/")) {
      await ctx.reply(
        ctx.state?.language === "en"
          ? "Please send a valid gift code, or tap Back to cancel."
          : "لطفاً کد هدیه را ارسال کن یا برای لغو «🔙 بازگشت» را بزن.",
        giftsMenu()
      );
      return;
    }

    pendingGiftCode.delete(ctx.from.id);

    try {
      const user = await getOrCreateUser(ctx.from);
      const reward = await redeemGiftCode({ userId: user.id, code });
      const language = ctx.state?.language || "fa";
      const details = [];
      if (reward.creditAmount > 0) details.push(`💳 +${reward.creditAmount} ${language === "en" ? "credits" : "اعتبار"}`);
      if (reward.xpAmount > 0) details.push(`✨ +${reward.xpAmount} XP`);
      if (reward.proDays > 0) details.push(`⭐ +${reward.proDays} ${language === "en" ? "Pro days" : "روز زکا پرو"}`);

      await ctx.reply(
        (language === "en" ? "🎉 Gift redeemed successfully!\n\n" : "🎉 کد هدیه با موفقیت ثبت شد!\n\n") +
          (reward.description ? reward.description + "\n" : "") +
          details.join("\n"),
        giftsMenu()
      );
    } catch (error) {
      console.error("Gift code redemption failed:", {
        telegramUserId: ctx.from.id,
        codeLength: code.length,
        error: error.message
      });
      await ctx.reply(giftErrorMessage(error, ctx.state?.language || "fa"), giftsMenu());
    }
  });
}

module.exports = { createGiftsHandler };
