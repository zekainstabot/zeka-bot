const userRepository = require("../repositories/user.repository");

async function getOrCreateUser(from) {
  if (!from || !from.id) {
    throw new Error("Telegram user information is required");
  }

  const telegramUserId = String(from.id);

  let user = await userRepository.findByTelegramUserId(telegramUserId);

  if (user) {
    return user;
  }

  const displayName = [from.first_name, from.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  user = await userRepository.create({
    telegramUserId,
    username: from.username || null,
    displayName: displayName || null,
  });

  return user;
}

module.exports = {
  getOrCreateUser,
};
