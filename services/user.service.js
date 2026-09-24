const userRepository = require("../repositories/user.repository");

async function getOrCreateUser(from) {
  if (!from || !from.id) {
    throw new Error("Telegram user information is required");
  }

  const telegramId = String(from.id);

  let user = await userRepository.findByTelegramId(telegramId);

  if (user) {
    return user;
  }

  user = await userRepository.create({
    telegramId,
    username: from.username || null,
    firstName: from.first_name || null,
    lastName: from.last_name || null,
  });

  return user;
}

module.exports = {
  getOrCreateUser,
};
