async function sendFileToUser({
  bot,
  telegramUserId,
  filePath,
  caption = "",
}) {
  if (!bot) {
    throw new Error("Telegram bot is required");
  }

  if (!telegramUserId) {
    throw new Error("Telegram user ID is required");
  }

  if (!filePath) {
    throw new Error("File path is required");
  }

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
  sendFileToUser,
};
