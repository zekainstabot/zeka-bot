"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { sendFileToChatOnce } = require("../services/delivery.service");
const { deductFeatureCredit, refundFeatureCredit } = require("../services/feature-credit.service");
const { getOrCreateUser } = require("../services/user.service");
const { searchFullTrack, downloadFullTrack } = require("../services/music-source.service");

const TIMEOUT = 10 *  60 * 1000;

function safeFileName(value) {
  return String(value || "song")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "song";
}

function createMusicSearchHandler({ bot }) {
  const sessions = new Map();

  const ask = async (ctx) => {
    sessions.set(String(ctx.from.id), Date.now());
    await ctx.reply(
      "🎵 اسم آهنگ یا خواننده رو بفرست؛ یه تیکه از متنش هم باشه پیداش می‌کنم و MP3 رو می‌فرستم."
    );
  };

  async function getJson(url) {
    const response = await fetch(url, {
      headers: { "User-Agent": "ZekaBot/1.0" },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("Lyrics provider HTTP " + response.status);
    return response.json();
  }

  bot.hears(["🎵 جست‌وجوی موسیقی", "🎵 جست‌وجوی آهنگ"], ask);

  bot.on("text", async (ctx, next) => {
    const id = String(ctx.from.id);
    const started = sessions.get(id);
    if (!started) return next();

    const query = String(ctx.message.text || "").trim();
    const navigationButtons = new Set([
      "🔙 بازگشت", "🛠 امکانات ویژه", "📥 دانلود", "👤 حساب من",
      "🎁 هدایا", "⭐ زکا پرو", "🌐 اتصال به زکا مدیا",
      "💬 ارتباط با پشتیبانی", "🎙 تبدیل ویس", "📆 تقویم روز",
      "📢 مدیریت انتشار محتوا", "🎡 گردونه شانس", "🧠 مسابقه", "🔮 فال",
    ]);

    if (navigationButtons.has(query)) {
      sessions.delete(id);
      return next();
    }
    if (Date.now() - started > TIMEOUT) {
      sessions.delete(id);
      await ctx.reply("⏱ زمان جست‌وجو تمام شد؛ دوباره از امکانات ویژه وارد شو.");
      return;
    }
    if (query.length < 2) {
      await ctx.reply("نام آهنگ یا بخشی از متن ترانه را بفرست.");
      return;
    }

    await ctx.reply("🔎 در حال جست‌وجوی نسخه کامل آهنگ...");
    let featureCharge = null;
    let featureUserId = null;
    let fileSent = false;
    let workDir = null;

    try {
      let matchedTitle = "";
      let matchedArtist = "";

      // متن ترانه ابتدا به نام آهنگ و خواننده تبدیل می‌شود.
      if (query.split(/\s+/).length >= 3) {
        try {
          const lyricsUrl = new URL("https://lrclib.net/api/search");
          lyricsUrl.searchParams.set("q", query);
          const matches = await getJson(lyricsUrl);
          const match = Array.isArray(matches) ? matches[0] : null;
          if (match) {
            matchedTitle = String(match.trackName || "").trim();
            matchedArtist = String(match.artistName || "").trim();
          }
        } catch (error) {
          console.warn("Lyrics identification failed:", error.message);
        }
      }

      const track = await searchFullTrack({
        title: matchedTitle,
        artist: matchedArtist,
        query,
      });

      if (!track) {
        await ctx.reply("❌ پیداش نکردم. یه اسم دیگه یا بخشی از متن آهنگ رو امتحان کن.");
        sessions.set(id, Date.now());
        return;
      }

      workDir = path.join(os.tmpdir(), "zeka-music-search", id, crypto.randomBytes(8).toString("hex"));
      fs.mkdirSync(workDir, { recursive: true });
      const mp3Path = path.join(workDir, safeFileName(track.title) + ".mp3");

      await downloadFullTrack(track, mp3Path);

      const user = await getOrCreateUser(ctx.from);
      featureUserId = user.id;
      featureCharge = await deductFeatureCredit({
        userId: featureUserId,
        feature: "music_search",
      });

      const creditLine = featureCharge.isPro
        ? "⭐ زکا پرو: بدون کسر اعتبار"
        : `💳 هزینه: ${featureCharge.cost} اعتبار | 💰 مانده: ${featureCharge.balance} اعتبار`;

      const attribution = track.licenseUrl
        ? `📜 مجوز: ${track.licenseUrl}`
        : "📜 مجوز دانلود بررسی شد";

      await sendFileToChatOnce({
        chatId: ctx.chat.id,
        filePath: mp3Path,
        contentType: "audio",
        caption: [
          `🎵 ${track.title}`,
          `👤 ${track.artist}`,
          `📚 منبع: ${track.source}`,
          track.pageUrl ? `🔗 ${track.pageUrl}` : "",
          attribution,
          creditLine,
        ].filter(Boolean).join("\n"),
      });
      fileSent = true;

      await ctx.reply("برای جست‌وجوی آهنگ بعدی، عبارت دیگری بفرست یا «🔙 بازگشت» را بزن.");
      sessions.set(id, Date.now());
    } catch (error) {
      if (featureCharge && !featureCharge.isPro && !fileSent) {
        try {
          await refundFeatureCredit({
            userId: featureUserId,
            feature: "music_search",
            charge: featureCharge,
          });
        } catch (refundError) {
          console.error("Music search credit refund failed:", refundError.message);
        }
      }

      console.error("Full music search failed:", error.message);
      if (error.code === "INSUFFICIENT_CREDIT") {
        await ctx.reply(
          `❌ اعتبار کافی نداری.\n\nهزینه جست‌وجوی آهنگ: ${error.cost} اعتبار\nاعتبار فعلی: ${error.balance} اعتبار\n\nاز بخش «📊 اعتبار من» می‌توانی اعتبارت را افزایش بدهی.`
        );
      } else {
        await ctx.reply(
          "❌ دریافت یا ارسال نسخه کامل MP3 ناموفق بود. اگر اعتباری کسر شده باشد، در صورت ناموفق بودن ارسال به حسابت برمی‌گردد."
        );
      }
      sessions.set(id, Date.now());
    } finally {
      if (workDir) {
        try {
          fs.rmSync(workDir, { recursive: true, force: true });
        } catch (error) {
          console.error("Music temp cleanup failed:", error.message);
        }
      }
    }
  });
}

module.exports = { createMusicSearchHandler };
