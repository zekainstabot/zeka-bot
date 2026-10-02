const { Markup } = require("telegraf");

const mainMenu = Markup.keyboard([
  ["📥 دانلود", "👤 حساب من"],
  ["🎁 هدایا", "⭐ زکا پرو"],
  ["🎮 مینی‌گیم‌ها", "🛠 امکانات ویژه"],
  ["📚 راهنما"],
])
  .resize()
  .persistent();

const accountMenu = Markup.keyboard([
  ["📊 اعتبار من", "🏆 سطح و XP"],
  ["🌐 زبان", "👤 اطلاعات حساب"],
  ["🔙 بازگشت"],
])
  .resize()
  .persistent();

const gamesMenu = Markup.keyboard([
  ["🎡 گردونه شانس", "🧠 مسابقه"],
  ["❌ لغو مسابقه", "🔙 بازگشت"],
])
  .resize()
  .persistent();

module.exports = {
  mainMenu,
  accountMenu,
  gamesMenu,
};
