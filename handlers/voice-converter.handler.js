"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { pipeline } = require("stream/promises");
const { Transform } = require("stream");
const { Markup } = require("telegraf");
const ffmpegPath = require("ffmpeg-static");

const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 50 * 1024 * 1024;
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const sessions = new Map();

const featuresMenu = Markup.keyboard([
  ["📢 مدیریت انتشار محتوا"],
  ["🎡 گردونه شانس", "🧠 مسابقه"],
  ["🔮 فال"],
  ["📆 تقویم روز"],
  ["🎙 تبدیل ویس"],
  ["🔙 بازگشت"],
]).resize().persistent();

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

  const fileLink = await ctx.telegram.getFileLink(fileId);
  const url = new URL(String(fileLink));

  await new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        https.get(response.headers.location, (redirected) => {
          if (redirected.statusCode !== 200) {
            redirected.resume();
            reject(new Error("TELEGRAM_FILE_DOWNLOAD_FAILED"));
            return;
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
          pipeline(redirected, limiter, fs.createWriteStream(destination))
            .then(resolve)
            .catch(reject);
        }).on("error", reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error("TELEGRAM_FILE_DOWNLOAD_FAILED"));
        return;
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
      pipeline(response, limiter, fs.createWriteStream(destination))
        .then(resolve)
        .catch(reject);
    });
    request.setTimeout(120000, () => request.destroy(new Error("DOWNLOAD_TIMEOUT")));
    request.on("error", reject);
  });
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
  bot.hears("🛠 امکانات ویژه", async (ctx) => {
    sessions.delete(String(ctx.from.id));
    await ctx.reply("🛠 امکانات ویژه\n\nیکی از امکانات را انتخاب کن.", featuresMenu);
  });

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

    const attachment = getAudioAttachment(ctx.message);
    if (!attachment) {
      await ctx.reply("لطفاً یک ویس تلگرام یا فایل صوتی بفرست. فایل‌های تصویری و اسناد غیرصوتی پشتیبانی نمی‌شوند.", converterMenu);
      return;
    }

    const workDir = path.join(os.tmpdir(), "zeka-voice-converter", userId, crypto.randomBytes(8).toString("hex"));
    const inputPath = path.join(workDir, "input");
    const outputPath = path.join(workDir, "output.mp3");

    try {
      fs.mkdirSync(workDir, { recursive: true });
      await ctx.reply("⏳ فایل دریافت شد؛ در حال تبدیل به MP3 هستم...");

      const fileInfo = await ctx.telegram.getFile(attachment.fileId);
      if (Number(fileInfo.file_size) > MAX_INPUT_BYTES) {
        throw new Error("INPUT_TOO_LARGE");
      }

      await downloadTelegramFile(ctx, attachment.fileId, inputPath, fileInfo.file_size);
      await convertToMp3(inputPath, outputPath);

      const outputSize = fs.statSync(outputPath).size;
      if (outputSize > MAX_OUTPUT_BYTES) throw new Error("OUTPUT_TOO_LARGE");

      const title = safeBaseName(attachment.fileName);
      await ctx.replyWithAudio(
        { source: outputPath, filename: `${title}.mp3` },
        {
          title,
          performer: "Zeka",
          caption: "✅ تبدیل با موفقیت انجام شد؛ فایل MP3 آماده ذخیره است.",
        }
      );
    } catch (error) {
      console.error("Voice to MP3 conversion failed:", {
        userId,
        message: error?.message || String(error),
      });

      let message = "❌ تبدیل فایل انجام نشد. لطفاً فایل دیگری را امتحان کن.";
      if (error.message === "INPUT_TOO_LARGE") {
        message = "❌ حجم فایل ورودی بیشتر از ۲۰ مگابایت است. لطفاً فایل کوچک‌تری بفرست.";
      } else if (error.message === "OUTPUT_TOO_LARGE") {
        message = "❌ حجم فایل MP3 خروجی از محدودیت ارسال تلگرام بیشتر شد.";
      } else if (error.message === "DOWNLOAD_TIMEOUT") {
        message = "⏱ دریافت فایل از تلگرام بیش از حد طول کشید. دوباره امتحان کن.";
      } else if (error.message === "CONVERSION_TIMEOUT") {
        message = "⏱ تبدیل فایل بیش از حد طول کشید. لطفاً فایل کوتاه‌تری بفرست.";
      } else if (error.message === "FFMPEG_NOT_AVAILABLE") {
        message = "❌ موتور تبدیل صدا روی سرور در دسترس نیست.";
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
