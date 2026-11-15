"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { pipeline } = require("stream/promises");
const { Readable, Transform } = require("stream");
const ffmpegPath = require("ffmpeg-static");
const { sendFileToChatOnce } = require("../services/delivery.service");
const { deductFeatureCredit, refundFeatureCredit } = require("../services/feature-credit.service");
const { getOrCreateUser } = require("../services/user.service");

const TIMEOUT = 10 * 60 * 1000;
const MAX_PREVIEW_BYTES = 20 * 1024 * 1024;

function safeFileName(value) {
  return String(value || "song")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "song";
}

async function downloadPreview(url, destination) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("INVALID_PREVIEW_URL");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(parsed, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "ZekaBot/1.0" },
    });
    if (!response.ok || !response.body) {
      throw new Error("PREVIEW_DOWNLOAD_HTTP_" + response.status);
    }

    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_PREVIEW_BYTES) throw new Error("PREVIEW_TOO_LARGE");

    let received = 0;
    const limiter = new Transform({
      transform(chunk, encoding, callback) {
        received += chunk.length;
        if (received > MAX_PREVIEW_BYTES) return callback(new Error("PREVIEW_TOO_LARGE"));
        callback(null, chunk);
      },
    });
    await pipeline(
      Readable.fromWeb(response.body),
      limiter,
      fs.createWriteStream(destination),
      { signal: controller.signal }
    );
    if (!received) throw new Error("EMPTY_PREVIEW");
  } catch (error) {
    if (controller.signal.aborted || error.name === "AbortError") {
      throw new Error("PREVIEW_DOWNLOAD_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function convertPreviewToMp3(inputPath, outputPath) {
  if (!ffmpegPath) throw new Error("FFMPEG_NOT_AVAILABLE");
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", inputPath, "-vn",
      "-codec:a", "libmp3lame", "-q:a", "2",
      "-map_metadata", "-1", outputPath,
    ], { stdio: ["ignore", "ignore", "pipe"] });

    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("PREVIEW_CONVERSION_TIMEOUT"));
    }, 90000);
    child.stderr.on("data", chunk => { stderr = (stderr + chunk.toString()).slice(-2000); });
    child.once("error", error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", code => {
      clearTimeout(timeout);
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        resolve();
      } else {
        reject(new Error(stderr || "PREVIEW_CONVERSION_FAILED"));
      }
    });
  });
}

function createMusicSearchHandler({ bot }) {
  const sessions = new Map();

  const ask = async (ctx) => {
    sessions.set(String(ctx.from.id), Date.now());
    await ctx.reply(
      "🎵 جست‌وجوی موسیقی\n\nنام آهنگ و خواننده، فقط نام آهنگ یا چند کلمه از متن ترانه را بفرست.\nفقط فایل MP3 ارسال می‌شود؛ اگر پیش‌نمایش MP3 موجود نباشد، فایلی ارسال نمی‌شود.\nبرای خروج «🔙 بازگشت» را بزن."
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
      "🔙 بازگشت", "🛠 امکانات ویژه", "📥 دانلود", "👤 حساب من",
      "🎁 هدایا", "⭐ زکا پرو", "🌐 اتصال به زکا مدیا",
      "💬 ارتباط با پشتیبانی", "🎙 تبدیل ویس", "📆 تقویم روز",
      "📢 مدیریت انتشار محتوا", "🎡 گردونه شانس", "🧠 مسابقه", "🔮 فال",
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
    let workDir = null;

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
        const term = [lyricMatch.artistName, lyricMatch.trackName].filter(Boolean).join(" ");
        if (term) {
          try {
            results = await itunes(term);
          } catch (error) {
            console.warn("iTunes lookup by lyric match:", error.message);
          }
        }
      }
      if (!results.length) results = await itunes(q);

      // Only the single top-ranked matching song is considered.
      const item = results[0] || null;
      if (!item) {
        await ctx.reply("❌ آهنگ مرتبطی پیدا نشد. نام خواننده یا عبارت دیگری را امتحان کن.");
        sessions.set(id, Date.now());
        return;
      }

      if (!item.previewUrl) {
        await ctx.reply("❌ برای این آهنگ پیش‌نمایش قابل دریافت وجود ندارد؛ بنابراین فایل MP3 ارسال نشد. نام یا آهنگ دیگری را امتحان کن.");
        sessions.set(id, Date.now());
        return;
      }

      const title = item.trackName || "آهنگ";
      const artist = item.artistName || "هنرمند نامشخص";
      workDir = path.join(os.tmpdir(), "zeka-music-search", id, crypto.randomBytes(8).toString("hex"));
      fs.mkdirSync(workDir, { recursive: true });
      const sourcePath = path.join(workDir, "preview-source");
      const mp3Path = path.join(workDir, safeFileName(title) + ".mp3");

      await downloadPreview(item.previewUrl, sourcePath);
      await convertPreviewToMp3(sourcePath, mp3Path);

      const user = await getOrCreateUser(ctx.from);
      featureUserId = user.id;
      featureCharge = await deductFeatureCredit({ userId: featureUserId, feature: "music_search" });

      const creditLine = featureCharge.isPro
        ? "⭐ زکا پرو: بدون کسر اعتبار"
        : `💳 هزینه: ${featureCharge.cost} اعتبار | 💰 مانده: ${featureCharge.balance} اعتبار`;

      await sendFileToChatOnce({
        chatId: ctx.chat.id,
        filePath: mp3Path,
        contentType: "audio",
        caption: `🎵 ${title}\n👤 ${artist}\n🎧 پیش‌نمایش رسمی آهنگ به فرمت MP3\n${creditLine}`,
      });

      await ctx.reply("برای جست‌وجوی آهنگ بعدی، عبارت دیگری بفرست یا «🔙 بازگشت» را بزن.");
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
        await ctx.reply(`❌ اعتبار کافی نداری.\n\nهزینه جست‌وجوی آهنگ: ${error.cost} اعتبار\nاعتبار فعلی: ${error.balance} اعتبار\n\nاز بخش «📊 اعتبار من» می‌توانی اعتبارت را افزایش بدهی.`);
      } else {
        await ctx.reply("❌ دریافت یا ساخت فایل MP3 ناموفق بود. اعتبارت کسر نشده یا در صورت کسر، به حسابت برگشت داده شد.");
      }
      sessions.set(id, Date.now());
    } finally {
      if (workDir) {
        try { fs.rmSync(workDir, { recursive: true, force: true }); }
        catch (error) { console.error("Music temp cleanup failed:", error.message); }
      }
    }
  });
}

module.exports = { createMusicSearchHandler };
