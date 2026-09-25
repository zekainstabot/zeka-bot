const userRepository = require("../repositories/user.repository");
const creditRepository = require("../repositories/credit.repository");

async function getOrCreateUser(from) {
  if (!from || !from.id) {
    throw new Error("Telegram user information is required");
  }

  const telegramUserId = String(from.id);

  let user =
    await userRepository.findByTelegramId(
      telegramUserId
    );

  if (user) {
    return user;
  }

  const displayName = [
    from.first_name,
    from.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  user = await userRepository.create({
    telegramUserId,
    username: from.username || null,
    displayName: displayName || null,
  });

  await creditRepository.create({
    userId: user.id,
    creditType: "DOWNLOAD",
    amount: 12,
    remainingAmount: 12,
    source: "WELCOME",
  });

  return user;
}

module.exports = {
  getOrCreateUser,
};
