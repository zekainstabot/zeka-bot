const { Telegraf } = require("telegraf");

const {
  mainMenu,
  accountMenu,
  gamesMenu,
} = require("./config/bot-menus");

const config = require("./config/app");

const {
  close,
} = require("./database/client");

const {
  register,
  shutdown,
} = require("./core/shutdown");

const {
  setBot: setDeliveryBot,
} = require("./services/delivery.service");

const {
  setBot: setReportBot,
} = require("./services/report.service");

const {
  createBasicHandler,
} = require("./handlers/basic.handler");

const {
  createAccountHandler,
} = require("./handlers/account.handler");

const {
  createGamesHandler,
} = require("./handlers/games.handler");

const {
  createGiftsHandler,
} = require("./handlers/gifts.handler");

const {
  createProHandler,
} = require("./handlers/pro.handler");

const {
  createFeaturesHandler,
} = require("./handlers/features.handler");

const {
  createHelpHandler,
} = require("./handlers/help.handler");

const {
  createNavigationHandler,
} = require("./handlers/navigation.handler");

const {
  createDownloadHandler,
} = require("./handlers/download.handler");

const {
  createAdminHandler,
} = require("./handlers/admin.handler");

const {
  createSuperAdminHandler,
} = require("./handlers/super-admin.handler");


const {
  createInstagramCookieHandler,
} = require("./handlers/instagram-cookie.handler");

const {
  createQuizHandler,
  cleanupQuizTimers,
} = require("./games/quiz/quiz.handler");

const {
  recoverJobs,
} = require("./services/queue-recovery.service");

const {
  recoverDeliveredJobs,
} = require("./services/delivery-recovery.service");

const {
  createFortuneHandler,
} = require("./handlers/fortune.handler");

const {
  createAdminFortuneHandler,
} = require("./handlers/admin-fortune.handler");

let bot = null;

function createBot() {
  if (bot) {
    return bot;
  }

  if (!config.bot.token) {
    throw new Error(
      "BOT_TOKEN is not configured"
    );
  }

  bot = new Telegraf(
    config.bot.token
  );

  bot.use(async (ctx, next) => {
  console.log(
    "TELEGRAM UPDATE RECEIVED:",
    ctx.update?.update_id,
    ctx.updateType,
    ctx.from?.id,
    ctx.message?.text || ""
  );

  return next();
});

  setDeliveryBot(bot);
  setReportBot(bot);

  createQuizHandler({
    bot,
    gamesMenu,
  });

  createAdminHandler(bot);

  createSuperAdminHandler(bot);

  
createInstagramCookieHandler(bot);

  createBasicHandler({
    bot,
    mainMenu,
  });

  createAccountHandler({
    bot,
    mainMenu,
    accountMenu,
  });

  createGamesHandler({
    bot,
    gamesMenu,
  });

  createGiftsHandler({
    bot,
    mainMenu,
  });

  createProHandler({
    bot,
    mainMenu,
  });

  createFeaturesHandler({
    bot,
    mainMenu,
  });

  createFortuneHandler({
    bot,
  });

  createAdminFortuneHandler(
    bot
  );

  createHelpHandler({
    bot,
    mainMenu,
  });

  createNavigationHandler({
    bot,
    mainMenu,
  });

  createDownloadHandler({
    bot,
    mainMenu,
  });

  register(async () => {
    cleanupQuizTimers();

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

process.once(
  "SIGINT",
  async () => {
    await shutdown("SIGINT");
  }
);

process.once(
  "SIGTERM",
  async () => {
    await shutdown("SIGTERM");
  }
);

async function startBot() {
  const telegramBot =
    createBot();

  console.log(
    "Starting delivery recovery..."
  );

  await recoverDeliveredJobs();

  console.log(
    "Delivery recovery finished."
  );

  console.log(
    "Starting queue recovery..."
  );

  await recoverJobs();

  console.log(
    "Queue recovery finished."
  );

  await telegramBot.launch();

  console.log(
    "Telegram bot started."
  );
}

module.exports = {
  createBot,
  startBot,
};
