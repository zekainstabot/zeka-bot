"use strict";

const TIMEOUT = 10 * 60 * 1000;

function createMusicSearchHandler({ bot }) {
  const sessions = new Map();
  const { deductFeatureCredit, refundFeatureCredit } = require("../services/feature-credit.service");
  const { getOrCreateUser } = require("../services/user.service");

  const ask = async (ctx) => {
    sessions.set(String(ctx.from.id), Date.now());
    await ctx.reply(
      "🎵 جست‌وجوی موسیقی\n\nنام آهنگ و خواننده، فقط نام آهنگ یا چند کلمه از متن ترانه را بفرست.\nبرای خروج «🔙 بازگشت» را بزن."
    );
  };

  async function getJson(url) {
    const res = await fetch(url, {
      headers: { "User-Agent": "ZekaBot/1.0" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error("Provider HTTP " + res.status);
    return res.json();
  }

  async function itunes(term) {
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", term);
    url.searchParams.set("entity", "song");
    url.searchParams.set("limit", "5");
    const data = await getJson(url);
    return Array.isArray(data.results) ? data.results : [];
  }

  bot.hears(["🎵 جست‌وجوی موسیقی", "🎵 جست‌وجوی آهنگ"], ask);

  bot.on("text", async (ctx, next) => {
    const id = String(ctx.from.id);
    const started = sessions.get(id);
    if (!started) return next();

    const q = String(ctx.message.text || "").trim();
    const navigationButtons = new Set([
      "🔙 بازگشت",
      "🛠 امکانات ویژه",
      "📥 دانلود",
      "👤 حساب من",
      "🎁 هدایا",
      "⭐ زکا پرو",
      "🌐 اتصال به زکا مدیا",
      "💬 ارتباط با پشتیبانی",
      "🎙 تبدیل ویس",
      "📆 تقویم روز",
      "📢 مدیریت انتشار محتوا",
      "🎡 گردونه شانس",
      "🧠 مسابقه",
      "🔮 فال",
    ]);

    if (navigationButtons.has(q)) {
      sessions.delete(id);
      return next();
    }

    if (Date.now() - started > TIMEOUT) {
      sessions.delete(id);
      await ctx.reply("⏱ زمان جست‌وجو تمام شد؛ دوباره از امکانات ویژه وارد شو.");
      return;
    }

    if (q.length < 2) {
      await ctx.reply("نام آهنگ یا بخشی از متن ترانه را بفرست.");
      return;
    }

    await ctx.reply("🔎 در حال جست‌وجوی آهنگ...");

    let featureCharge = null;
    let featureUserId = null;
    try {
      let lyricMatch = null;

      if (q.split(/\s+/).length >= 3) {
        try {
          const url = new URL("https://lrclib.net/api/search");
          url.searchParams.set("q", q);
          const data = await getJson(url);
          lyricMatch = Array.isArray(data) ? data[0] || null : null;
        } catch (error) {
          console.warn("Lyrics lookup:", error.message);
        }
      }

      let results = [];
      if (lyricMatch) {
        const term = [lyricMatch.artistName, lyricMatch.trackName]
          .filter(Boolean)
          .join(" ");
        if (term) {
          try {
            results = await itunes(term);
          } catch (error) {
            console.warn("iTunes lookup by lyric match:", error.message);
          }
        }
      }

      if (!results.length) {
        results = await itunes(q);
      }

      // Only ever send the single highest-ranked provider result.
      const item = results[0] || lyricMatch;
      if (!item) {
        await ctx.reply("❌ آهنگ مرتبطی پیدا نشد. نام خواننده یا عبارت دیگری را امتحان کن.");
        sessions.set(id, Date.now());
        return;
      }

      const user = await getOrCreateUser(ctx.from);
      featureUserId = user.id;
      featureCharge = await deductFeatureCredit({ userId: featureUserId, feature: "music_search" });

      const title = item.trackName || "آهنگ";
      const artist = item.artistName || "هنرمند نامشخص";
      const keyboard = [];

      if (item.trackViewUrl) {
        keyboard.push([{ text: "🍎 Apple Music", url: item.trackViewUrl }]);
      }
      keyboard.push([{
        text: "🟢 جست‌وجو در Spotify",
        url: "https://open.spotify.com/search/" + encodeURIComponent(title + " " + artist),
      }]);

      const creditLine = featureCharge.isPro
        ? "\n\n⭐ زکا پرو: بدون کسر اعتبار"
        : `\n\n💳 هزینه جست‌وجو: ${featureCharge.cost} اعتبار\n💰 مانده: ${featureCharge.balance} اعتبار`;
      const caption =
        "🎵 " + title + "\n👤 " + artist +
        (item.collectionName ? "\n💿 " + item.collectionName : "") + creditLine;

      if (item.previewUrl) {
        try {
          await ctx.replyWithAudio(item.previewUrl, {
            title,
            performer: artist,
            caption: caption + "\n\n🎧 پیش‌نمایش کوتاه",
            reply_markup: { inline_keyboard: keyboard },
          });
        } catch (error) {
          console.warn("Preview send failed:", error.message);
          await ctx.reply(caption + "\nپیش‌نمایش قابل ارسال نبود.", {
            reply_markup: { inline_keyboard: keyboard },
          });
        }
      } else {
        await ctx.reply(caption + "\nپیش‌نمایش در دسترس نیست.", {
          reply_markup: { inline_keyboard: keyboard },
        });
      }

      await ctx.reply("برای جست‌وجوی بعدی، عبارت دیگری بفرست یا «🔙 بازگشت» را بزن.");
      sessions.set(id, Date.now());
    } catch (error) {
      if (featureCharge && !featureCharge.isPro) {
        try {
          await refundFeatureCredit({ userId: featureUserId, feature: "music_search", charge: featureCharge });
        } catch (refundError) {
          console.error("Music search credit refund failed:", refundError.message);
        }
      }
      console.error("Music search failed:", error.message);
      if (error.code === "INSUFFICIENT_CREDIT") {
        await ctx.reply(`❌ اعتبار کافی نداری.\n\nهزینه جست‌وجوی آهنگ: ${error.cost} اعتبار\nاعتبار فعلی: ${error.balance}\n\nاز بخش «📊 اعتبار من» می‌توانی اعتبارت را افزایش بدهی.`);
      } else {
        await ctx.reply("❌ جست‌وجوی موسیقی فعلاً انجام نشد. کمی بعد دوباره امتحان کن.");
      }
      sessions.set(id, Date.now());
    }
  });
}

module.exports = { createMusicSearchHandler };
