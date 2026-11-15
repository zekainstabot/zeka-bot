"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { pipeline } = require("stream/promises");
const { Transform, Readable } = require("stream");
const { Markup } = require("telegraf");
const { featuresMenu } = require("../config/bot-menus");
const ffmpegPath = require("ffmpeg-static");
const { sendFileToChatOnce } = require("../services/delivery.service");

const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 50 * 1024 * 1024;
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const sessions = new Map();

const converterMenu = Markup.keyboard([
  ["🔙 بازگشت"],
]).resize().persistent();

function getAudioAttachment(message) {
  if (message?.voice) {
    return { fileId: message.voice.file_id, fileName: "voice.ogg", type: "ویس تلگرام" };
  }
  if (message?.audio) {
    const name = message.audio.file_name || "audio";
    return { fileId: message.audio.file_id, fileName: name, type: "فایل صوتی" };
  }
  if (message?.document) {
    const document = message.document;
    const fileName = document.file_name || "audio";
    const extension = path.extname(fileName).toLowerCase();
    const audioExtensions = new Set([
      ".aac", ".aif", ".aiff", ".amr", ".flac", ".m4a", ".m4b",
      ".m4p", ".mid", ".midi", ".mp3", ".oga", ".ogg", ".opus",
      ".wav", ".wma", ".webm",
    ]);
    const isAudio = String(document.mime_type || "").toLowerCase().startsWith("audio/")
      || audioExtensions.has(extension);
    if (isAudio) {
      return { fileId: document.file_id, fileName, type: "فایل صوتی" };
    }
  }
  return null;
}

function safeBaseName(fileName) {
  const base = path.basename(String(fileName || "Zeka-Voice"))
    .replace(/\.[^.]+$/, "")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "Zeka-Voice";
}

async function downloadTelegramFile(ctx, fileId, destination, expectedSize) {
  if (Number(expectedSize) > MAX_INPUT_BYTES) {
    throw new Error("INPUT_TOO_LARGE");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    // Native fetch follows Telegram's CDN redirects automatically.
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const response = await fetch(String(fileLink), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`TELEGRAM_FILE_DOWNLOAD_HTTP_${response.status}`);
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_INPUT_BYTES) {
      throw new Error("INPUT_TOO_LARGE");
    }

    let received = 0;
    const limiter = new Transform({
      transform(chunk, encoding, callback) {
        received += chunk.length;
        if (received > MAX_INPUT_BYTES) {
          callback(new Error("INPUT_TOO_LARGE"));
          return;
        }
        callback(null, chunk);
      },
    });

    await pipeline(
      Readable.fromWeb(response.body),
      limiter,
      fs.createWriteStream(destination),
      { signal: controller.signal }
    );

    if (!received) {
      throw new Error("EMPTY_TELEGRAM_FILE");
    }
  } catch (error) {
    if (controller.signal.aborted || error?.name === "AbortError") {
      throw new Error("DOWNLOAD_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function convertToMp3(inputPath, outputPath) {
  if (!ffmpegPath) throw new Error("FFMPEG_NOT_AVAILABLE");

  return new Promise((resolve, reject) => {
    const args = [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-i", inputPath,
      "-vn",
      "-codec:a", "libmp3lame",
      "-q:a", "2",
      "-map_metadata", "-1",
      outputPath,
    ];

    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("CONVERSION_TIMEOUT"));
    }, 180000);

    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-3000);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        resolve();
      } else {
        reject(new Error(stderr || "AUDIO_CONVERSION_FAILED"));
      }
    });
  });
}

function createVoiceConverterHandler({ bot }) {
  bot.hears("🎙 تبدیل ویس", async (ctx) => {
    sessions.set(String(ctx.from.id), { createdAt: Date.now() });
    await ctx.reply(
      "🎙 تبدیل ویس به MP3\n\n" +
      "ویس تلگرام، ویس فورواردشده یا فایل صوتی/آهنگ را همین‌جا بفرست.\n" +
      "فایل به MP3 تبدیل می‌شود و به‌صورت فایل قابل ذخیره برمی‌گردد.\n\n" +
      "حداکثر حجم ورودی: ۲۰ مگابایت",
      converterMenu
    );
  });

  bot.hears("🔙 بازگشت", async (ctx, next) => {
    const userId = String(ctx.from?.id || "");
    if (!sessions.has(userId)) return next();
    sessions.delete(userId);
    await ctx.reply("🛠 امکانات ویژه\n\nیکی از امکانات را انتخاب کن.", featuresMenu);
  });

  bot.on("message", async (ctx, next) => {
    const userId = String(ctx.from?.id || "");
    const session = sessions.get(userId);
    if (!session) return next();

    if (Date.now() - session.createdAt > SESSION_TIMEOUT_MS) {
      sessions.delete(userId);
      await ctx.reply("⏱ زمان استفاده از تبدیل ویس تمام شد. دوباره از امکانات ویژه وارد شو.", featuresMenu);
      return;
    }

    const navigationButtons = new Set([
      "📥 دانلود",
      "👤 حساب من",
      "🎁 هدایا",
      "⭐ زکا پرو",
      "🌐 اتصال به زکا مدیا",
      "💬 ارتباط با پشتیبانی",
      "🛠 امکانات ویژه",
      "🎵 جست‌وجوی موسیقی",
      "🎵 جست‌وجوی آهنگ",
      "📆 تقویم روز",
      "📢 مدیریت انتشار محتوا",
      "🎡 گردونه شانس",
      "🧠 مسابقه",
      "🔮 فال",
    ]);
    if (navigationButtons.has(ctx.message?.text)) {
      sessions.delete(userId);
      return next();
    }

    const attachment = getAudioAttachment(ctx.message);
    if (!attachment) {
      await ctx.reply("لطفاً یک ویس تلگرام یا فایل صوتی بفرست. فایل‌های تصویری و اسناد غیرصوتی پشتیبانی نمی‌شوند.", converterMenu);
      return;
    }

    let stage = "prepare";
    const workDir = path.join(os.tmpdir(), "zeka-voice-converter", userId, crypto.randomBytes(8).toString("hex"));
    const inputPath = path.join(workDir, "input");
    const outputPath = path.join(workDir, "output.mp3");

    try {
      fs.mkdirSync(workDir, { recursive: true });
      await ctx.reply("⏳ فایل دریافت شد؛ در حال تبدیل به MP3 هستم...");

      stage = "telegram_metadata";
      const fileInfo = await ctx.telegram.getFile(attachment.fileId);
      if (Number(fileInfo.file_size) > MAX_INPUT_BYTES) {
        throw new Error("INPUT_TOO_LARGE");
      }

      stage = "download";
      await downloadTelegramFile(ctx, attachment.fileId, inputPath, fileInfo.file_size);
      stage = "convert";
      await convertToMp3(inputPath, outputPath);

      const outputSize = fs.statSync(outputPath).size;
      if (outputSize > MAX_OUTPUT_BYTES) throw new Error("OUTPUT_TOO_LARGE");

      const title = safeBaseName(attachment.fileName);
      stage = "telegram_upload";
      const audioCaption = "✅ تبدیل با موفقیت انجام شد؛ فایل MP3 آماده ذخیره است.";

      // Use the direct multipart HTTPS uploader shared with downloader delivery.
      // This avoids Telegraf's separate upload transport path.
      await sendFileToChatOnce({
        chatId: ctx.chat.id,
        filePath: outputPath,
        caption: audioCaption,
        contentType: "audio",
      });
    } catch (error) {
      console.error("Voice to MP3 conversion failed:", {
        userId,
        stage,
        message: error?.message || String(error),
        stack: error?.stack,
      });

      let message = "❌ عملیات ناموفق شد. لطفاً دوباره امتحان کن.";
      if (error.message === "INPUT_TOO_LARGE") {
        message = "❌ حجم فایل ورودی بیشتر از ۲۰ مگابایت است. لطفاً فایل کوچک‌تری بفرست.";
      } else if (error.message === "OUTPUT_TOO_LARGE") {
        message = "❌ حجم فایل MP3 خروجی از محدودیت ارسال تلگرام بیشتر شد.";
      } else if (error.message === "DOWNLOAD_TIMEOUT") {
        message = "⏱ دریافت فایل از تلگرام بیشتر از ۲ دقیقه طول کشید و متوقف شد.";
      } else if (error.message === "CONVERSION_TIMEOUT") {
        message = "⏱ تبدیل فایل بیشتر از ۳ دقیقه طول کشید و متوقف شد.";
      } else if (error.message === "FFMPEG_NOT_AVAILABLE" || error.code === "ENOENT") {
        message = "❌ موتور تبدیل صدا روی سرور نصب یا اجرا نشده است. خطا برای بررسی ثبت شد.";
      } else if (stage === "telegram_metadata" || stage === "download") {
        message = "❌ دریافت فایل از تلگرام ناموفق شد. لطفاً ویس را دوباره ارسال کن.";
      } else if (stage === "convert") {
        message = "❌ فایل دریافت شد، اما تبدیل آن به MP3 ناموفق بود. ممکن است فرمت فایل پشتیبانی نشود.";
      } else if (stage === "telegram_upload") {
        const details = [
          error?.response?.description,
          error?.description,
          error?.message,
        ].filter(Boolean).join(" | ");
        const errorCode = error?.response?.error_code || error?.code;
        const safeDetails = String(details || "Unknown Telegram upload error")
          .replace(/https?:\/\/\S+/gi, "[link]")
          .replace(/[\r\n\t]+/g, " ")
          .slice(0, 350);
        message =
          "❌ تبدیل انجام شد، اما تلگرام فایل MP3 را نپذیرفت.\n" +
          (errorCode ? `کد خطا: ${errorCode}\n` : "") +
          `جزئیات: ${safeDetails}\n\n` +
          "لطفاً همین پیام خطا را برای پشتیبانی بفرست.";
      }
      await ctx.reply(message, converterMenu);
    } finally {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("Voice converter temp cleanup failed:", cleanupError?.message || cleanupError);
      }
    }
  });
}

module.exports = { createVoiceConverterHandler };
