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
          `از منوی پایین، بخش موردنظرت را انتخاب کن.`,
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
            "از منوی پایین، بخش موردنظرت را انتخاب کن.",
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
        "برای دانلود محتوا، ابتدا از منوی پایین «📥 دانلود» را انتخاب کن.\n\n" +
        "بعد از ورود به بخش دانلود، لینک محتوا را ارسال کن.\n\n" +
        "اگر در بخش دیگری از ربات هستی، ارسال لینک باعث قطع آن بخش نمی‌شود.",
      mainMenu
    );
  });
}

module.exports = {
  createBasicHandler,
};
