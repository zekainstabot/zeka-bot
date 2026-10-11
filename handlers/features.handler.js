
function createFeaturesHandler({
  bot,
  mainMenu,
}) {
  const { getOrCreateUser } = require("../services/user.service");
  const {
    createScheduledPost,
  } = require("../features/scheduled-publishing/publishing.repository");

  const states = new Map();
  const SESSION_TIMEOUT = 10 * 60 * 1000;

  const scheduleMenu = {
    reply_markup: {
      keyboard: [
        ["⏱ 1 ساعت", "⏱ 3 ساعت"],
        ["⏱ 7 ساعت", "⏱ 12 ساعت"],
        ["📅 فردا", "📅 پس‌فردا"],
        ["📅 یک هفته بعد"],
        ["🔙 بازگشت"],
      ],
      resize_keyboard: true,
      persistent: true,
    },
  };

  const featuresMenu = {
    reply_markup: {
      keyboard: [
        ["📅 انتشار زمان‌بندی‌شده"],
        ["🔙 بازگشت"],
      ],
      resize_keyboard: true,
      persistent: true,
    },
  };

  function getState(ctx) {
    return states.get(String(ctx.from.id));
  }

  function setState(ctx, state) {
    states.set(String(ctx.from.id), {
      ...state,
      createdAt: Date.now(),
    });
  }

  function clearState(ctx) {
    states.delete(String(ctx.from.id));
  }

  function isInstagramUrl(value) {
    try {
      const url = new URL(value.trim());

      return (
        url.protocol === "https:" &&
        [
          "instagram.com",
          "www.instagram.com",
          "m.instagram.com",
        ].includes(url.hostname.toLowerCase())
      );
    } catch {
      return false;
    }
  }

  function getScheduledAt(choice) {
    const now = new Date();
    const scheduledAt = new Date(now);

    const hours = {
      "⏱ 1 ساعت": 1,
      "⏱ 3 ساعت": 3,
      "⏱ 7 ساعت": 7,
      "⏱ 12 ساعت": 12,
    };

    if (hours[choice]) {
      scheduledAt.setTime(
        now.getTime() + hours[choice] * 60 * 60 * 1000
      );

      return scheduledAt;
    }

    const days = {
      "📅 فردا": 1,
      "📅 پس‌فردا": 2,
      "📅 یک هفته بعد": 7,
    };

    if (days[choice]) {
      scheduledAt.setDate(
        scheduledAt.getDate() + days[choice]
      );

      return scheduledAt;
    }

    return null;
  }

  bot.hears("🛠 امکانات ویژه", async (ctx) => {
    clearState(ctx);

    await ctx.reply(
      "🛠 امکانات ویژه\n\n" +
        "امکان موردنظرت را انتخاب کن.",
      featuresMenu
    );
  });

  bot.hears("📅 انتشار زمان‌بندی‌شده", async (ctx) => {
    setState(ctx, {
      step: "instagram_url",
    });

    await ctx.reply(
      "📅 انتشار زمان‌بندی‌شده\n\n" +
        "لینک عمومی پست یا ریلز اینستاگرام را بفرست.",
      featuresMenu
    );
  });

  bot.on("text", async (ctx, next) => {
    const state = getState(ctx);

    if (!state) {
      return next();
    }

    const userId = String(ctx.from.id);
    const text = ctx.message.text.trim();

    if (Date.now() - state.createdAt > SESSION_TIMEOUT) {
      clearState(ctx);

      await ctx.reply(
        "⏱ زمان این فرایند تمام شد. دوباره از امکانات ویژه شروع کن.",
        mainMenu
      );

      return;
    }

    if (text === "🔙 بازگشت") {
      clearState(ctx);
      return next();
    }

    if (
      [
        "📥 دانلود",
        "👤 حساب من",
        "🎁 هدایا",
        "⭐ زکا پرو",
        "🎮 مینی‌گیم‌ها",
        "🛠 امکانات ویژه",
        "🔮 فال",
      ].includes(text)
    ) {
      clearState(ctx);
      return next();
    }

    if (state.step === "instagram_url") {
      if (!isInstagramUrl(text)) {
        await ctx.reply(
          "❌ لینک معتبر اینستاگرام نیست.\n" +
            "لطفاً لینک کامل یک پست یا ریلز عمومی را بفرست."
        );

        return;
      }

      setState(ctx, {
        step: "channel",
        sourceUrl: text,
      });

      await ctx.reply(
        "✅ لینک دریافت شد.\n\n" +
          "حالا آیدی یا لینک کانال مقصد را بفرست.\n\n" +
          "مثال: @mychannel\n\n" +
          "ربات باید در همان کانال دسترسی انتشار داشته باشد."
      );

      return;
    }

    if (state.step === "channel") {
      let channel;

      try {
        channel = await ctx.telegram.getChat(text);
      } catch (error) {
        await ctx.reply(
          "❌ کانال پیدا نشد یا ربات به آن دسترسی ندارد.\n\n" +
            "آیدی یا لینک کانال را بررسی کن و دوباره بفرست."
        );

        return;
      }

      if (channel.type !== "channel") {
        await ctx.reply(
          "❌ مقصد واردشده کانال تلگرام نیست.\n" +
            "آیدی یا لینک یک کانال را بفرست."
        );

        return;
      }

      try {
        const botInfo = await ctx.telegram.getMe();
        const member = await ctx.telegram.getChatMember(
          channel.id,
          botInfo.id
        );

        if (
          !["administrator", "creator"].includes(member.status) ||
          member.can_post_messages === false
        ) {
          await ctx.reply(
            "❌ ربات در این کانال دسترسی انتشار ندارد.\n\n" +
              "ربات را ادمین کن و اجازه ارسال پیام بده؛ سپس دوباره آیدی کانال را بفرست."
          );

          return;
        }
      } catch (error) {
        await ctx.reply(
          "❌ نتوانستم دسترسی انتشار ربات را تأیید کنم.\n\n" +
            "بررسی کن ربات ادمین کانال باشد و دوباره تلاش کن."
        );

        return;
      }

      setState(ctx, {
        step: "schedule",
        sourceUrl: state.sourceUrl,
        telegramChatId: String(channel.id),
        channelTitle: channel.title || channel.username || null,
      });

      await ctx.reply(
        "✅ کانال تأیید شد.\n" +
          `📢 مقصد: ${channel.title || channel.username || channel.id}\n\n` +
          "زمان انتشار را انتخاب کن:",
        scheduleMenu
      );

      return;
    }

    if (state.step === "schedule") {
      const scheduledAt = getScheduledAt(text);

      if (!scheduledAt) {
        await ctx.reply(
          "یکی از زمان‌های موجود در منو را انتخاب کن.",
          scheduleMenu
        );

        return;
      }

      try {
        const user = await getOrCreateUser(ctx.from);

        if (!user || !user.id) {
          throw new Error("User database record not found");
        }

        const post = await createScheduledPost({
          userId: user.id,
          telegramChatId: state.telegramChatId,
          channelTitle: state.channelTitle,
          sourceUrl: state.sourceUrl,
          scheduledAt: scheduledAt.toISOString(),
          captionMode: "original",
          captionOrder: "original_first",
        });

        clearState(ctx);

        await ctx.reply(
          "✅ انتشار زمان‌بندی شد.\n\n" +
            `🆔 شماره برنامه: ${post.id}\n` +
            `📢 کانال: ${state.channelTitle || state.telegramChatId}\n` +
            `🕒 زمان انتشار: ${scheduledAt.toLocaleString("fa-IR", {
              timeZone: "Asia/Tehran",
            })}\n\n` +
            "برنامه انتشار به حساب خودت متصل است.",
          mainMenu
        );
      } catch (error) {
        console.error(
          "Create scheduled post failed:",
          error?.message || error
        );

        await ctx.reply(
          "❌ ثبت برنامه انتشار انجام نشد.\n" +
            "اطلاعات این مرحله پاک نشده است؛ دوباره زمان را انتخاب کن.",
          scheduleMenu
        );
      }

      return;
    }

    return next();
  });
}

module.exports = {
  createFeaturesHandler,
};
