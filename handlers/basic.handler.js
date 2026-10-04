const {
  setUserCommands,
} = require("../services/command.service");

const {
  getAdminByTelegramId,
} = require("../services/admin.service");

function createBasicHandler({
  bot,
  mainMenu,
}) {
  bot.start(async (ctx) => {
    try {
      const {
        getOrCreateUser,
      } = require("../services/user.service");

      const user =
        await getOrCreateUser(
          ctx.from
        );

      let role = "user";

      try {
        const admin =
          await getAdminByTelegramId(
            ctx.from.id
          );

        if (
          admin &&
          admin.is_active
        ) {
          if (
            admin.role_key ===
            "super_admin"
          ) {
            role = "super_admin";
          } else if (
            admin.role_key ===
            "admin"
          ) {
            role = "admin";
          }
        }
      } catch (error) {
        console.error(
          "Start admin lookup failed:",
          error
        );
      }

      try {
        await setUserCommands(
          ctx.telegram,
          ctx.from.id,
          role
        );
      } catch (error) {
        console.error(
          "Start set user commands failed:",
          error
        );
      }

      const name =
        user?.display_name ||
        user?.username ||
        ctx.from?.first_name ||
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

      try {
        await ctx.reply(
          "سلام 👋\n\n" +
            "به زکا خوش آمدی.\n\n" +
            "🔗 برای دانلود، فقط لینک محتوای موردنظرت رو همینجا ارسال کن.",
          mainMenu
        );
      } catch (replyError) {
        console.error(
          "Start fallback reply failed:",
          replyError
        );
      }
    }
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      "📚 راهنمای زکا\n\n" +
        "🔗 برای دانلود، فقط لینک محتوا را ارسال کن.\n\n" +
        "زکا به‌صورت خودکار نوع محتوا و پلتفرم را تشخیص می‌دهد.\n\n" +
        "برای دسترسی به بخش‌های مختلف هم می‌توانی از منوی پایین استفاده کنی.",
      mainMenu
    );
  });

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
}

module.exports = {
  createBasicHandler,
};
