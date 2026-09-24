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

  const bot = getBot();
  const chatId = String(telegramUserId);

  console.log(
    `Sending downloaded file to Telegram user: ${chatId}`
  );

  await bot.telegram.sendDocument(
    chatId,
    {
      source: filePath,
    },
    {
      caption,
    }
  );

  return {
    success: true,
    chatId,
    filePath,
  };
}

module.exports = {
  setBot,
  getBot,
  sendFileToUser,
};
