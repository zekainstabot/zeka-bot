const {
  setUserCommands,
} = require("../services/command.service");

const {
  getAdminByTelegramId,
} = require("../services/admin.service");

const {
  issueWebLoginCode,
} = require("../services/web-login.service");

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

      const startPayload = String(ctx.startPayload || "");

      if (startPayload.startsWith("web_")) {
        try {
          const result = await issueWebLoginCode(
            startPayload.slice(4),
            user
          );

          if (!result.ok) {
            await ctx.reply(
              "این لینک ورود معتبر نیست یا منقضی شده است. به سایت زکا مدیا برگرد و یک کد جدید بگیر."
            );
            return;
          }

          await ctx.reply(
            "🔐 کد ورود زکا مدیا\n\n" +
            "کد یک‌بارمصرف شما:\n" +
            `<code>${result.code}</code>\n\n` +
            "این کد تا ۱۰ دقیقه معتبر است و فقط در سایت رسمی zeka-media.onrender.com واردش کن.\n" +
            "این کد را برای هیچ‌کس نفرست.",
            { parse_mode: "HTML" }
          );
          return;
        } catch (error) {
          console.error("Web login code issue failed:", error);
          await ctx.reply("فعلاً امکان ساخت کد ورود وجود ندارد. کمی بعد دوباره تلاش کن.");
          return;
        }
      }

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
          "به زکا خوش آمدی.\n\n" +
          "از منوی پایین، بخش موردنظرت را انتخاب کن.",
        mainMenu
      );
    } catch (error) {
      console.error(
        "Start handler failed:",
        {
          errorCode:
            error?.response?.error_code,
          retryAfter:
            error?.response?.parameters?.retry_after,
          message: error?.message,
        }
      );
    }
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      "📚 راهنمای زکا\n\n" +
        "برای دانلود محتوا، ابتدا از منوی پایین «📥 دانلود» را انتخاب کن.\n\n" +
        "بعد از ورود به بخش دانلود، لینک محتوا را ارسال کن.\n\n" +
        "اگر در بخش دیگری از ربات هستی، ارسال لینک باعث قطع آن بخش نمی‌شود."
    , mainMenu);
  });
}

module.exports = {
  createBasicHandler,
};
