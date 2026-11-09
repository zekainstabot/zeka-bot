
const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

let telegramBot = null;

function setBot(bot) {
  if (!bot) {
    throw new Error("Telegram bot is required");
  }

  telegramBot = bot;
}

function getBot() {
  if (!telegramBot) {
    throw new Error("Telegram bot has not been initialized");
  }

  return telegramBot;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTelegramUploadConfig(contentType, forceDocument = false) {
  const normalizedType = String(contentType || "video")
    .trim()
    .toLowerCase();

  if (forceDocument || normalizedType === "document") {
    return {
      endpoint: "sendDocument",
      fieldName: "document",
      mimeType: "application/octet-stream",
      label: "document",
    };
  }

  if (normalizedType === "photo" || normalizedType === "image") {
    return {
      endpoint: "sendPhoto",
      fieldName: "photo",
      mimeType: "image/jpeg",
      label: "photo",
    };
  }

  if (normalizedType === "audio") {
    return {
      endpoint: "sendAudio",
      fieldName: "audio",
      mimeType: "audio/mpeg",
      label: "audio",
    };
  }

  return {
    endpoint: "sendVideo",
    fieldName: "video",
    mimeType: "video/mp4",
    label: "video",
  };
}

function createMultipartRequest({
  token,
  chatId,
  filePath,
  caption = "",
  contentType = "video",
  replyMarkup = null,
  forceDocument = false,
}) {
  return new Promise((resolve, reject) => {
    if (!token) {
      reject(new Error("Telegram bot token is required"));
      return;
    }

    if (!chatId) {
      reject(new Error("Telegram chat ID is required"));
      return;
    }

    if (!filePath || !fs.existsSync(filePath)) {
      reject(new Error(`Downloaded file does not exist: ${filePath}`));
      return;
    }

    const stats = fs.statSync(filePath);

    if (!stats.isFile() || stats.size <= 0) {
      reject(new Error("Downloaded file is invalid or empty"));
      return;
    }

    const uploadConfig = getTelegramUploadConfig(
      contentType,
      forceDocument
    );

    const boundary =
      "----ZekaTelegramBoundary" +
      crypto.randomBytes(16).toString("hex");

    const fileName = path.basename(filePath).replace(/["\r\n]/g, "_");

    let captionValue = String(caption || "").trim();

    if (captionValue.length > 1024) {
      captionValue = captionValue.slice(0, 1021) + "...";
    }

    const fields = [
      ["chat_id", String(chatId)],
    ];

    if (captionValue) {
      fields.push(["caption", captionValue]);
    }

    if (replyMarkup) {
      fields.push(["reply_markup", JSON.stringify(replyMarkup)]);
    }

    let fieldsBuffer = Buffer.alloc(0);

    for (const [name, value] of fields) {
      fieldsBuffer = Buffer.concat([
        fieldsBuffer,
        Buffer.from(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
          `${value}\r\n`,
          "utf8"
        ),
      ]);
    }

    const fileHeader = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${uploadConfig.fieldName}"; filename="${fileName}"\r\n` +
      `Content-Type: ${uploadConfig.mimeType}\r\n\r\n`,
      "utf8"
    );

    const ending = Buffer.from(
      `\r\n--${boundary}--\r\n`,
      "utf8"
    );

    const contentLength =
      fieldsBuffer.length +
      fileHeader.length +
      stats.size +
      ending.length;

    const request = https.request(
      {
        hostname: "api.telegram.org",
        port: 443,
        path: `/bot${token}/${uploadConfig.endpoint}`,
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": contentLength,
          "Connection": "close",
        },
        timeout: 180000,
      },
      (response) => {
        let responseData = "";

        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          responseData += chunk;
        });

        response.on("end", () => {
          let parsed;

          try {
            parsed = JSON.parse(responseData);
          } catch {
            parsed = null;
          }

          if (
            response.statusCode >= 200 &&
            response.statusCode < 300 &&
            parsed?.ok === true
          ) {
            resolve(parsed);
            return;
          }

          const error = new Error(
            parsed?.description ||
            `Telegram ${uploadConfig.endpoint} failed: HTTP ${response.statusCode}`
          );

          error.response = parsed;
          error.telegramHttpStatus = response.statusCode;

          reject(error);
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Telegram upload timed out"));
    });

    request.on("error", reject);

    request.write(fieldsBuffer);
    request.write(fileHeader);

    const fileStream = fs.createReadStream(filePath);

    fileStream.on("error", (error) => {
      request.destroy(error);
    });

    fileStream.on("end", () => {
      request.write(ending);
      request.end();
    });

    fileStream.pipe(request, { end: false });
  });
}

/**
 * ارسال فایل با یک تلاش و بدون Retry.
 * برای انتشار زکا مدیا در کانال استفاده می‌شود.
 */
async function sendFileToChatOnce({
  chatId,
  filePath,
  caption = "",
  contentType = "video",
  replyMarkup = null,
  forceDocument = false,
}) {
  const bot = getBot();

  if (!chatId) {
    throw new Error("Telegram destination chat ID is required");
  }

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("Downloaded file does not exist");
  }

  const stats = fs.statSync(filePath);

  if (!stats.isFile() || stats.size <= 0) {
    throw new Error("Downloaded file is invalid or empty");
  }

  console.log("Telegram single upload started:", {
    chatId,
    filePath,
    fileSizeBytes: stats.size,
    contentType,
    forceDocument,
  });

  const result = await createMultipartRequest({
    token: bot.telegram.token,
    chatId: String(chatId),
    filePath,
    caption,
    contentType,
    replyMarkup,
    forceDocument,
  });

  console.log("Telegram single upload completed:", {
    chatId,
    fileSizeBytes: stats.size,
    messageId: result?.result?.message_id || null,
  });

  return result.result;
}

const DELIVERY_FOOTER = [
  "🤖 ربات: @zekagpt_bot",
  "📢 کانال: @zeka_media",
  "🌐 سایت: https://zeka-media.onrender.com",
].join("\n");

function buildDeliveryCaption(caption = "") {
  const original = String(caption || "").trim();
  const separator = original ? "\n\n" : "";
  const availableLength = 1024 - DELIVERY_FOOTER.length - separator.length;

  if (original.length <= availableLength) {
    return original + separator + DELIVERY_FOOTER;
  }

  const suffix = "...";
  const shortened = original.slice(0, Math.max(0, availableLength - suffix.length)).trimEnd();
  return shortened + suffix + "\n\n" + DELIVERY_FOOTER;
}

/**
 * ارسال فایل خصوصی.
 * سه تلاش قبلی برای این مسیر حفظ شده است.
 */
async function sendFileToUser({
  telegramUserId,
  telegramChatId,
  filePath,
  caption = "",
  contentType = "video",
}) {
  const destinationChatId = telegramChatId || telegramUserId;

  if (!destinationChatId) {
    throw new Error("Telegram user ID is required");
  }

  if (!filePath) {
    throw new Error("File path is required");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Downloaded file does not exist: ${filePath}`);
  }

  const stats = fs.statSync(filePath);

  if (!stats.isFile() || stats.size <= 0) {
    throw new Error(`Downloaded file is empty or invalid: ${filePath}`);
  }

  const bot = getBot();
  const token = bot.telegram.token;
  const chatId = String(destinationChatId);
  const uploadConfig = getTelegramUploadConfig(contentType);

  console.log("Sending downloaded file to Telegram user:", chatId);
  console.log("Telegram upload file:", filePath, stats.size);
  console.log("Telegram content type:", contentType);
  console.log("Telegram upload method:", uploadConfig.endpoint);

  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `Direct Telegram ${uploadConfig.label} upload attempt ${attempt}/${maxAttempts}`
      );

      const result = await createMultipartRequest({
        token,
        chatId,
        filePath,
        caption: buildDeliveryCaption(caption),
        contentType,
      });

      console.log(
        `Direct Telegram ${uploadConfig.label} upload successful on attempt ${attempt}`
      );

      return {
        success: true,
        chatId,
        filePath,
        contentType,
        response: result,
      };
    } catch (error) {
      lastError = error;

      console.error(
        `Direct Telegram ${uploadConfig.label} upload failed on attempt ${attempt}/${maxAttempts}:`,
        error.message
      );

      if (attempt < maxAttempts) {
        const delay = attempt * 3000;

        console.log(`Retrying upload in ${delay}ms...`);

        await sleep(delay);
      }
    }
  }

  throw lastError;
}

module.exports = {
  setBot,
  getBot,
  sendFileToUser,
  sendFileToChatOnce,
  buildDeliveryCaption,
};
