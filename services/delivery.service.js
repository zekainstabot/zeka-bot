const fs = require("fs");

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

async function sendFileToUser({
  telegramUserId,
  filePath,
  caption = "",
}) {
  if (!telegramUserId) {
    throw new Error("Telegram user ID is required");
  }

  if (!filePath) {
    throw new Error("File path is required");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Downloaded file does not exist: ${filePath}`);
  }

  const stats = fs.statSync(filePath);

  if (!stats.isFile()) {
    throw new Error(`Downloaded path is not a file: ${filePath}`);
  }

  if (stats.size <= 0) {
    throw new Error(`Downloaded file is empty: ${filePath}`);
  }

  const bot = getBot();
  const chatId = String(telegramUserId);

  console.log(
    `Sending downloaded file to Telegram user: ${chatId}`
  );

  console.log(
    `Telegram upload file: ${filePath} (${stats.size} bytes)`
  );

  const maxAttempts = 3;

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `Telegram upload attempt ${attempt}/${maxAttempts}`
      );

      await bot.telegram.sendDocument(
        chatId,
        {
          source: fs.createReadStream(filePath),
        },
        {
          caption,
        }
      );

      console.log(
        `Telegram upload successful on attempt ${attempt}`
      );

      return {
        success: true,
        chatId,
        filePath,
      };
    } catch (error) {
      lastError = error;

      console.error(
        `Telegram upload failed on attempt ${attempt}/${maxAttempts}:`,
        error?.message || error
      );

      if (attempt < maxAttempts) {
        const delay = attempt * 3000;

        console.log(
          `Retrying Telegram upload in ${delay}ms...`
        );

        await sleep(delay);
      }
    }
  }

  console.error(
    `Telegram upload failed after ${maxAttempts} attempts.`
  );

  throw lastError;
}

module.exports = {
  setBot,
  getBot,
  sendFileToUser,
};
