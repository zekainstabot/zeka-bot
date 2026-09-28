const { Telegraf, Markup } = require("telegraf");

const config = require("./config/app");
const { close, getClient } = require("./database/client");
const { register, shutdown } = require("./core/shutdown");
const { getOrCreateUser } = require("./services/user.service");
const { getAccountSummary } = require("./services/account.service");
const { parseUrl } = require("./services/url.service");
const {
  createDownloadRequest,
} = require("./services/request.service");
const {
  setBot: setDeliveryBot,
} = require("./services/delivery.service");
const {
  handleAdminCommand,
} = require("./handlers/admin.handler");

const {
  startSpin,
} = require("./games/wheel/wheel.service");

const {
  createQuizHandler,
  cleanupQuizTimers,
} = require("./games/quiz/quiz.handler");

const gameService = require("./games/game.service");

let bot = null;

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

function createBot() {
  if (bot) {
    return bot;
  }

  if (!config.bot.token) {
    throw new Error("BOT_TOKEN is not configured");
  }

  bot = new Telegraf(config.bot.token);

  setDeliveryBot(bot);

  // =========================
  // START
  // =========================

  bot.start(async (ctx) => {
    try {
      const user =
        await getOrCreateUser(
          ctx.from
        );

      const name =
        user.display_name ||
        user.username ||
        ctx.from.first_name ||
        "دوست";

      await ctx.reply(
        `سلام ${name} 👋\n\n` +
          `به زکا خوش آمدی.\n\n` +
          `🔗 برای دانلود، فقط لینک محتوای موردنظرت رو همینجا ارسال کن.`,
        mainMenu
      );
    } catch (error) {
      console.error(
        "Start handler failed:",
        error
      );

      await ctx.reply(
        "❌ در ثبت اطلاعات شما مشکلی پیش آمد.\nلطفاً دوباره تلاش کنید."
      );
    }
  });

  // =========================
  // HELP
  // =========================

  bot.help(async (ctx) => {
    await ctx.reply(
      "📚 راهنمای زکا\n\n" +
        "🔗 برای دانلود، فقط لینک محتوا را ارسال کن.\n\n" +
        "زکا به‌صورت خودکار نوع محتوا و پلتفرم را تشخیص می‌دهد.\n\n" +
        "برای دسترسی به بخش‌های مختلف هم می‌توانی از منوی پایین استفاده کنی.",
      mainMenu
    );
  });

  // =========================
  // DOWNLOAD BUTTON
  // =========================

  bot.hears(
    "📥 دانلود",
    async (ctx) => {
      await ctx.reply(
        "📥 دانلود\n\n" +
          "لینک محتوایی که می‌خواهی دانلود شود را ارسال کن.\n\n" +
          "مثال:\n" +
          "https://www.instagram.com/...",
        mainMenu
      );
    }
  );

  // =========================
  // ACCOUNT
  // =========================

  bot.hears(
    "👤 حساب من",
    async (ctx) => {
      try {
        const user =
          await getOrCreateUser(
            ctx.from
          );

        const account =
          await getAccountSummary(
            user
          );

        const proStatus =
          account.isPro
            ? "⭐ فعال"
            : "❌ فعال نیست";

        await ctx.reply(
          "👤 حساب من\n\n" +
            `👤 نام: ${
              account.displayName ||
              "ثبت نشده"
            }\n` +
            `🆔 شناسه: ${
              account.telegramUserId
            }\n\n` +
            `💳 اعتبار: ${
              account.credit
            }\n` +
            `🏆 سطح: ${
              account.level
            }\n` +
            `✨ XP: ${
              account.xp
            }\n` +
            `🔥 روزهای فعال متوالی: ${
              account.streakDays
            }\n\n` +
            `⭐ زکا پرو: ${proStatus}`,
          accountMenu
        );
      } catch (error) {
        console.error(
          "Account menu failed:",
          error
        );

        await ctx.reply(
          "❌ دریافت اطلاعات حساب انجام نشد.\nلطفاً دوباره تلاش کنید.",
          mainMenu
        );
      }
    }
  );

  // =========================
  // GIFTS
  // =========================

  bot.hears(
    "🎁 هدایا",
    async (ctx) => {
      await ctx.reply(
        "🎁 هدایا\n\n" +
          "به‌زودی بخش‌های زیر در این قسمت قرار می‌گیرند:\n\n" +
          "👥 دعوت دوستان\n" +
          "🎰 شانس\n" +
          "🎯 مأموریت‌ها\n" +
          "➕ درخواست اعتبار بیشتر",
        mainMenu
      );
    }
  );

  // =========================
  // PRO
  // =========================

  bot.hears(
    "⭐ زکا پرو",
    async (ctx) => {
      await ctx.reply(
        "⭐ زکا پرو\n\n" +
          "نسخه پرو امکانات بیشتری در اختیار شما قرار می‌دهد.\n\n" +
          "💎 پلن‌های ۱، ۲، ۳، ۶ و ۱۲ ماهه\n" +
          "🚀 محدودیت دانلود بیشتر\n" +
          "🎁 امکانات ویژه\n" +
          "⭐ شانس بیشتر در جوایز\n\n" +
          "بخش خرید پرو به‌زودی فعال می‌شود.",
        mainMenu
      );
    }
  );

  // =========================
  // SPECIAL FEATURES
  // =========================

  bot.hears(
    "🛠 امکانات ویژه",
    async (ctx) => {
      await ctx.reply(
        "🛠 امکانات ویژه\n\n" +
          "این بخش برای امکانات پیشرفته زکا در نظر گرفته شده است.\n\n" +
          "📊 اطلاعات صفحات\n" +
          "📦 آرشیو صفحات عمومی\n" +
          "🎵 دانلود صوت\n" +
          "👀 مانیتور صفحات\n" +
          "📥 دانلود محتوای بیشتر\n\n" +
          "این امکانات به‌مرور فعال می‌شوند.",
        mainMenu
      );
    }
  );

  // =========================
  // GUIDE
  // =========================

  bot.hears(
    "📚 راهنما",
    async (ctx) => {
      await ctx.reply(
        "📚 راهنمای استفاده از زکا\n\n" +
          "1️⃣ لینک محتوای موردنظر را ارسال کن.\n\n" +
          "2️⃣ زکا پلتفرم و نوع محتوا را تشخیص می‌دهد.\n\n" +
          "3️⃣ درخواست وارد صف پردازش می‌شود.\n\n" +
          "4️⃣ پس از آماده شدن فایل، آن را برایت ارسال می‌کنیم.\n\n" +
          "💡 لازم نیست نوع محتوا را دستی انتخاب کنی.",
        mainMenu
      );
    }
  );

  // =========================
  // ACCOUNT - CREDIT
  // =========================

  bot.hears(
    "📊 اعتبار من",
    async (ctx) => {
      try {
        const user =
          await getOrCreateUser(
            ctx.from
          );

        const account =
          await getAccountSummary(
            user
          );

        const credits =
          account.credits || {};

        await ctx.reply(
          "📊 اعتبار من\n\n" +
            `🔄 رول‌اور: ${
              credits.rollover || 0
            }\n` +
            `📅 اعتبار روزانه: ${
              credits.daily || 0
            }\n` +
            `👥 اعتبار دعوت: ${
              credits.referral || 0
            }\n` +
            `💳 اعتبار خریداری‌شده: ${
              credits.purchased || 0
            }\n` +
            `➕ سایر اعتبارها: ${
              credits.other || 0
            }\n\n` +
            `💰 مجموع اعتبار: ${
              account.credit
            }\n\n` +
            "ℹ️ مصرف اعتبار طبق اولویت سیستم زکا انجام می‌شود.",
          accountMenu
        );
      } catch (error) {
        console.error(
          "Credit menu failed:",
          error
        );

        await ctx.reply(
          "❌ دریافت اعتبار انجام نشد.\nلطفاً دوباره تلاش کنید.",
          mainMenu
        );
      }
    }
  );

  // =========================
  // ACCOUNT - XP
  // =========================

  bot.hears(
    "🏆 سطح و XP",
    async (ctx) => {
      try {
        const user =
          await getOrCreateUser(
            ctx.from
          );

        const account =
          await getAccountSummary(
            user
          );

        await ctx.reply(
          "🏆 سطح و XP\n\n" +
            `🏆 سطح فعلی: ${
              account.level
            }\n` +
            `✨ XP فعلی: ${
              account.xp
            }\n` +
            `🔥 روزهای فعال متوالی: ${
              account.streakDays
            }\n\n` +
            "جزئیات سیستم سطح و XP به‌زودی تکمیل می‌شود.",
          accountMenu
        );
      } catch (error) {
        console.error(
          "XP menu failed:",
          error
        );

        await ctx.reply(
          "❌ دریافت اطلاعات سطح انجام نشد.\nلطفاً دوباره تلاش کنید.",
          mainMenu
        );
      }
    }
  );

  // =========================
  // ACCOUNT - LANGUAGE
  // =========================

  bot.hears(
    "🌐 زبان",
    async (ctx) => {
      await ctx.reply(
        "🌐 زبان\n\n" +
          `زبان فعلی حساب شما: ${
            ctx.from.language_code ||
            "fa"
          }\n\n` +
          "بخش انتخاب زبان در مرحله بعد تکمیل می‌شود.",
        accountMenu
      );
    }
  );

  // =========================
  // ACCOUNT - INFORMATION
  // =========================

  bot.hears(
    "👤 اطلاعات حساب",
    async (ctx) => {
      try {
        const user =
          await getOrCreateUser(
            ctx.from
          );

        const account =
          await getAccountSummary(
            user
          );

        await ctx.reply(
          "👤 اطلاعات حساب\n\n" +
            `👤 نام: ${
              account.displayName ||
              "ثبت نشده"
            }\n` +
            `🔹 نام کاربری: ${
              account.username
                ? "@" +
                  account.username
                : "ثبت نشده"
            }\n` +
            `🆔 شناسه تلگرام: ${
              account.telegramUserId
            }\n` +
            `🏆 سطح: ${
              account.level
            }\n` +
            `✨ XP: ${
              account.xp
            }\n` +
            `⭐ زکا پرو: ${
              account.isPro
                ? "فعال"
                : "فعال نیست"
            }`,
          accountMenu
        );
      } catch (error) {
        console.error(
          "Account information failed:",
          error
        );

        await ctx.reply(
          "❌ دریافت اطلاعات حساب انجام نشد.\nلطفاً دوباره تلاش کنید.",
          mainMenu
        );
      }
    }
  );

  // =========================
  // MINI GAMES
  // =========================

  bot.hears(
    "🎮 مینی‌گیم‌ها",
    async (ctx) => {
      await ctx.reply(
        "🎮 مینی‌گیم‌ها\n\n" +
          "یکی از بازی‌ها را انتخاب کن:",
        gamesMenu
      );
    }
  );

  // =========================
  // WHEEL OF FORTUNE
  // =========================

  bot.hears(
    "🎡 گردونه شانس",
    async (ctx) => {
      try {
        const user =
          await getOrCreateUser(
            ctx.from
          );

        const account =
          await getAccountSummary(
            user
          );

        if (
          Number(
            account.credit || 0
          ) < 1
        ) {
          await ctx.reply(
            "❌ برای گردونه حداقل 1 اعتبار لازم داری.\n\n" +
              `💳 اعتبار فعلی: ${
                account.credit || 0
              }`,
            gamesMenu
          );

          return;
        }

        await ctx.reply(
          "🎡 گردونه شانس\n\n" +
            "🎲 تاس را می‌اندازیم...\n\n" +
            "🎁 شانس برد: 50٪\n" +
            "😐 پوچ: 50٪\n\n" +
            "💳 هزینه: 1 اعتبار",
          gamesMenu
        );

        const diceMessage =
          await ctx.replyWithDice({
            emoji: "🎲",
          });

        const diceValue =
          Number(
            diceMessage?.dice?.value ||
              0
          );

        if (
          !Number.isInteger(
            diceValue
          ) ||
          diceValue < 1 ||
          diceValue > 6
        ) {
          throw new Error(
            "Invalid Telegram dice result"
          );
        }

        await new Promise(
          (resolve) => {
            setTimeout(
              resolve,
              1600
            );
          }
        );

        const result =
          await startSpin({
            userId:
              user.id,

            diceValue,
          });

        const prize =
          result.result;

        let message =
          "🎡 نتیجه گردونه\n\n" +
          `🎲 عدد تاس: ${diceValue}\n\n`;

        if (
          prize.result_type ===
          "CREDIT"
        ) {
          message +=
            `🎉 جایزه: +${prize.credit_amount} اعتبار\n`;
        } else if (
          prize.result_type ===
          "XP"
        ) {
          message +=
            `🎉 جایزه: +${prize.xp_amount} XP\n`;
        } else if (
          prize.result_type ===
          "PRO"
        ) {
          message +=
            `🎉 جایزه: +${prize.pro_days} روز زکا پرو\n`;
        } else {
          message +=
            "😐 این بار پوچ شد!\n" +
            "دوباره شانس خودت را امتحان کن.";
        }

        message +=
          "\n\n💳 هزینه: 1 اعتبار";

        await ctx.reply(
          message,
          gamesMenu
        );
      } catch (error) {
        console.error(
          "Wheel spin failed:",
          error
        );

        if (
          error &&
          (
            error.message ===
              "Insufficient credit" ||
            error.code ===
              "INSUFFICIENT_CREDIT"
          )
        ) {
          await ctx.reply(
            "❌ اعتبار کافی برای چرخاندن گردونه نداری.",
            gamesMenu
          );

          return;
        }

        await ctx.reply(
          "❌ اجرای گردونه انجام نشد.\nلطفاً دوباره تلاش کن.",
          gamesMenu
        );
      }
    }
  );

  // =========================
  // BACK TO MAIN MENU
  // =========================

  bot.hears(
    "🔙 بازگشت",
    async (ctx) => {
      await ctx.reply(
        "🏠 منوی اصلی",
        mainMenu
      );
    }
  );

  // =========================
  // ADMIN
  // =========================

  bot.command(
    "admin",
    handleAdminCommand
  );

  // =========================
  // TEXT / DOWNLOAD REQUEST
  // =========================

  bot.on(
    "text",
    async (ctx) => {
      const text =
        ctx.message.text.trim();

      if (
        !text ||
        text.startsWith("/")
      ) {
        return;
      }

      const menuButtons = [
        "📥 دانلود",
        "👤 حساب من",
        "🎁 هدایا",
        "⭐ زکا پرو",
        "🎮 مینی‌گیم‌ها",
        "🎡 گردونه شانس",
        "🧠 مسابقه",
        "❌ لغو مسابقه",
        "🛠 امکانات ویژه",
        "📚 راهنما",
        "📊 اعتبار من",
        "🏆 سطح و XP",
        "🌐 زبان",
        "👤 اطلاعات حساب",
        "🔙 بازگشت",
      ];

      if (
        menuButtons.includes(text)
      ) {
        return;
      }

      try {
        const user =
          await getOrCreateUser(
            ctx.from
          );

        const parsed =
          parseUrl(text);

        if (!parsed.valid) {
          await ctx.reply(
            "❌ لینک معتبر نیست.\n\n" +
              "یک لینک کامل مثل این ارسال کن:\n" +
              "https://www.instagram.com/...",
            mainMenu
          );

          return;
        }

        if (!parsed.platform) {
          await ctx.reply(
            "⚠️ این لینک متعلق به پلتفرم‌های پشتیبانی‌شده نیست.",
            mainMenu
          );

          return;
        }

        const result =
          await createDownloadRequest({
            userId:
              user.id,

            platform:
              parsed.platform,

            originalUrl:
              text,

            normalizedUrl:
              parsed.url,

            contentType:
              parsed.contentType,
          });

        const request =
          result.request;

        const job =
          result.job;

        await ctx.reply(
          `✅ درخواست شما ثبت شد.\n\n` +
            `🆔 درخواست: ${
              request.request_id
            }\n` +
            `⚙️ وظیفه: ${
              job.job_id
            }\n` +
            `📱 پلتفرم: ${
              request.platform
            }\n` +
            `⏳ وضعیت: در صف پردازش`,
          mainMenu
        );
      } catch (error) {
        console.error(
          "Download request failed:",
          error
        );

        if (
          error &&
          error.code ===
            "DUPLICATE_ACTIVE_REQUEST"
        ) {
          await ctx.reply(
            "⏳ این لینک در حال حاضر در صف پردازش است.\n\n" +
              "لطفاً صبر کن تا دانلود قبلی تمام شود.",
            mainMenu
          );

          return;
        }

        if (
          error &&
          error.code ===
            "PLATFORM_DISABLED"
        ) {
          await ctx.reply(
            `⚠️ دانلود از ${
              error.platform
            } در حال حاضر غیرفعال است.\n\n` +
              "لطفاً بعداً دوباره تلاش کن.",
            mainMenu
          );

          return;
        }

        await ctx.reply(
          "❌ ثبت درخواست انجام نشد.\nلطفاً دوباره تلاش کنید.",
          mainMenu
        );
      }
    }
  );
    // =========================
  // SHUTDOWN
  // =========================

  register(async () => {
    for (
      const timer of quizTimers.values()
    ) {
      clearTimeout(timer);
    }

    quizTimers.clear();

    if (bot) {
      await bot.stop(
        "shutdown"
      );
    }
  });

  register(async () => {
    await close();
  });

  return bot;
}

// =========================
// PROCESS SIGNALS
// =========================

process.once(
  "SIGINT",
  async () => {
    await shutdown(
      "SIGINT"
    );
  }
);

process.once(
  "SIGTERM",
  async () => {
    await shutdown(
      "SIGTERM"
    );
  }
);

// =========================
// START BOT
// =========================

async function startBot() {
  const telegramBot =
    createBot();

  await telegramBot.launch();

  console.log(
    "Telegram bot started."
  );
}

module.exports = {
  createBot,
  startBot,
};
