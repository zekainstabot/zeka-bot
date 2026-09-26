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

function getTelegramUploadConfig(contentType) {
  const normalizedType = String(
    contentType || "video"
  )
    .trim()
    .toLowerCase();

  if (normalizedType === "photo") {
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

  if (normalizedType === "document") {
    return {
      endpoint: "sendDocument",
      fieldName: "document",
      mimeType: "application/octet-stream",
      label: "document",
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
  caption,
  contentType,
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

    if (!filePath) {
      reject(new Error("File path is required"));
      return;
    }

    if (!fs.existsSync(filePath)) {
      reject(
        new Error(`Downloaded file does not exist: ${filePath}`)
      );
      return;
    }

    const stats = fs.statSync(filePath);

    if (!stats.isFile()) {
      reject(
        new Error(`Downloaded path is not a file: ${filePath}`)
      );
      return;
    }

    if (stats.size <= 0) {
      reject(new Error("Downloaded file is empty"));
      return;
    }

    const uploadConfig =
      getTelegramUploadConfig(contentType);

    const boundary =
      "----ZekaTelegramBoundary" +
      crypto.randomBytes(16).toString("hex");

    const fileName = path.basename(filePath);

    let captionValue =
      typeof caption === "string"
        ? caption.trim()
        : "";

    if (captionValue.length > 1024) {
      captionValue =
        captionValue.slice(0, 1021) + "...";
    }

    const chatIdPart =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="chat_id"\r\n\r\n` +
      `${chatId}\r\n`;

    const filePart =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${uploadConfig.fieldName}"; filename="${fileName}"\r\n` +
      `Content-Type: ${uploadConfig.mimeType}\r\n\r\n`;

    const captionPart = captionValue
      ? `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="caption"\r\n\r\n` +
        `${captionValue}\r\n`
      : "";

    const ending =
      `\r\n--${boundary}--\r\n`;

    const chatIdBuffer = Buffer.from(
      chatIdPart,
      "utf8"
    );

    const fileBuffer = Buffer.from(
      filePart,
      "utf8"
    );

    const captionBuffer = Buffer.from(
      captionPart,
      "utf8"
    );

    const endingBuffer = Buffer.from(
      ending,
      "utf8"
    );

    const contentLength =
      chatIdBuffer.length +
      fileBuffer.length +
      stats.size +
      captionBuffer.length +
      endingBuffer.length;

    const options = {
      hostname: "api.telegram.org",
      port: 443,
      path: `/bot${token}/${uploadConfig.endpoint}`,
      method: "POST",
      headers: {
        "Content-Type":
          `multipart/form-data; boundary=${boundary}`,
        "Content-Length": contentLength,
        "Connection": "close",
      },
      timeout: 120000,
    };

    console.log(
      `Direct Telegram ${uploadConfig.label} upload started: ${fileName} (${stats.size} bytes)`
    );

    const request = https.request(
      options,
      (response) => {
        let responseData = "";

        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          responseData += chunk;
        });

        response.on("end", () => {
          if (
            response.statusCode >= 200 &&
            response.statusCode < 300
          ) {
            let parsed;

            try {
              parsed = JSON.parse(responseData);
            } catch {
              parsed = null;
            }

            if (parsed && parsed.ok === false) {
              reject(
                new Error(
                  `Telegram API error: ${
                    parsed.description || responseData
                  }`
                )
              );
              return;
            }

            console.log(
              `Direct Telegram ${uploadConfig.label} upload successful: HTTP ${response.statusCode}`
            );

            resolve({
              success: true,
              response: parsed,
            });

            return;
          }

          reject(
            new Error(
              `Telegram ${uploadConfig.endpoint} failed: HTTP ${
                response.statusCode
              } - ${responseData}`
            )
          );
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(
        new Error(
          `Telegram ${uploadConfig.label} upload request timed out`
        )
      );
    });

    request.on("error", (error) => {
      reject(error);
    });

    request.write(chatIdBuffer);
    request.write(fileBuffer);

    const fileStream =
      fs.createReadStream(filePath);

    fileStream.on("error", (error) => {
      request.destroy(error);
    });

    fileStream.on("end", () => {
      request.write(captionBuffer);
      request.write(endingBuffer);
      request.end();
    });

    fileStream.pipe(request, {
      end: false,
    });
  });
}

async function sendFileToUser({
  telegramUserId,
  filePath,
  caption = "",
  contentType = "video",
}) {
  if (!telegramUserId) {
    throw new Error("Telegram user ID is required");
  }

  if (!filePath) {
    throw new Error("File path is required");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Downloaded file does not exist: ${filePath}`
    );
  }

  const stats = fs.statSync(filePath);

  if (!stats.isFile()) {
    throw new Error(
      `Downloaded path is not a file: ${filePath}`
    );
  }

  if (stats.size <= 0) {
    throw new Error(
      `Downloaded file is empty: ${filePath}`
    );
  }

  const bot = getBot();

  const token = bot.telegram.token;
  const chatId = String(telegramUserId);

  const uploadConfig =
    getTelegramUploadConfig(contentType);

  console.log(
    `Sending downloaded file to Telegram user: ${chatId}`
  );

  console.log(
    `Telegram upload file: ${filePath} (${stats.size} bytes)`
  );

  console.log(
    `Telegram content type: ${contentType}`
  );

  console.log(
    `Telegram upload method: ${uploadConfig.endpoint}`
  );

  const maxAttempts = 3;

  let lastError = null;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    try {
      console.log(
        `Direct Telegram ${uploadConfig.label} upload attempt ${attempt}/${maxAttempts}`
      );

      const result =
        await createMultipartRequest({
          token,
          chatId,
          filePath,
          caption,
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
        response: result.response,
      };
    } catch (error) {
      lastError = error;

      console.error(
        `Direct Telegram ${uploadConfig.label} upload failed on attempt ${attempt}/${maxAttempts}:`,
        error?.message || error
      );

      if (attempt < maxAttempts) {
        const delay = attempt * 3000;

        console.log(
          `Retrying direct Telegram ${uploadConfig.label} upload in ${delay}ms...`
        );

        await sleep(delay);
      }
    }
  }

  console.error(
    `Direct Telegram ${uploadConfig.label} upload failed after ${maxAttempts} attempts.`
  );

  throw lastError;
}

module.exports = {
  setBot,
  getBot,
  sendFileToUser,
};
