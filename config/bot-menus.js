
const { Markup } = require("telegraf");

const mainMenu = Markup.keyboard([
  ["📥 دانلود", "👤 حساب من"],
  ["🎁 هدایا", "⭐ زکا پرو"],
  ["🛠 امکانات ویژه"],
])
  .resize()
  .oneTime(false);

const downloadMenu = Markup.keyboard([
  ["🔙 بازگشت"],
])
  .resize();

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

const fortuneMenu = Markup.keyboard([
  ["📖 فال حافظ", "❤️ فال عشق"],
  ["🌙 فال روزانه", "💰 فال مالی"],
  ["🎯 فال نیت"],
  ["🔙 بازگشت"],
])
  .resize()
  .persistent();

module.exports = {
  mainMenu,
  downloadMenu,
  accountMenu,
  gamesMenu,
  fortuneMenu,
};
