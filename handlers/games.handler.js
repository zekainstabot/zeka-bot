function createGamesHandler({
  bot,
  gamesMenu,
}) {
  const {
    getOrCreateUser,
  } = require("../services/user.service");

  const {
    getAccountSummary,
  } = require("../services/account.service");

  const {
    startSpin,
  } = require("../games/wheel/wheel.service");

  bot.hears("🎮 مینی‌گیم‌ها", async (ctx) => {
    await ctx.reply(
      "🎮 مینی‌گیم‌ها\n\n" +
        "یکی از بازی‌ها را انتخاب کن:",
      gamesMenu
    );
  });

  bot.hears("🎡 گردونه شانس", async (ctx) => {
    try {
      const user = await getOrCreateUser(ctx.from);
      const account = await getAccountSummary(user);

      if (Number(account.credit || 0) < 1) {
        await ctx.reply(
          "❌ برای گردونه حداقل 1 اعتبار لازم داری.\n\n" +
            `💳 اعتبار فعلی: ${account.credit || 0}`,
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

      const diceValue = Number(
        diceMessage?.dice?.value || 0
      );

      if (
        !Number.isInteger(diceValue) ||
        diceValue < 1 ||
        diceValue > 6
      ) {
        throw new Error(
          "Invalid Telegram dice result"
        );
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 1600);
      });

      const result = await startSpin({
        userId: user.id,
        diceValue,
      });

      const prize = result.result;

      let message =
        "🎡 نتیجه گردونه\n\n" +
        `🎲 عدد تاس: ${diceValue}\n\n`;

      if (
        prize.result_type === "CREDIT"
      ) {
        message += `🎉 جایزه: +${prize.credit_amount} اعتبار\n`;
      } else if (
        prize.result_type === "XP"
      ) {
        message += `🎉 جایزه: +${prize.xp_amount} XP\n`;
      } else if (
        prize.result_type === "PRO"
      ) {
        message += `🎉 جایزه: +${prize.pro_days} روز زکا پرو\n`;
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
        (error.message ===
          "Insufficient credit" ||
          error.code ===
            "INSUFFICIENT_CREDIT")
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
  });
}

module.exports = {
  createGamesHandler,
};
