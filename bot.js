
const https = require("https");
const { Telegraf } = require("telegraf");

const {
  mainMenu,
  downloadMenu,
  accountMenu,
  gamesMenu,
} = require("./config/bot-menus");

const config = require("./config/app");

const { close } = require("./database/client");

const { register, shutdown } = require("./core/shutdown");

const { setBot: setDeliveryBot } = require("./services/delivery.service");
const { setBot: setReportBot } = require("./services/report.service");
const { setBot: setZekaMediaBot } = require("./services/zeka-media.service");

const {
  startZekaMediaExpirationService,
  stopZekaMediaExpirationService,
} = require("./services/zeka-media-expiration.service");

const {
  recoverStalePublishing,
} = require("./repositories/zeka-media.repository");

const { createBasicHandler } = require("./handlers/basic.handler");
const { createWebLoginHandler } = require("./handlers/web-login.handler");
const { userBlockMiddleware } = require("./middleware/user-block.middleware");
const { createAccountHandler } = require("./handlers/account.handler");
const { createGamesHandler } = require("./handlers/games.handler");
const { createGiftsHandler } = require("./handlers/gifts.handler");
const { createProHandler } = require("./handlers/pro.handler");
const { createFeaturesHandler } = require("./handlers/features.handler");
const { createHelpHandler } = require("./handlers/help.handler");
const { createNavigationHandler } = require("./handlers/navigation.handler");

const {
  startScheduledPublishing,
  stopScheduledPublishing,
} = require("./features/scheduled-publishing/publishing.scheduler");

const {
  startProPurchaseNotificationScheduler,
  stopProPurchaseNotificationScheduler,
} = require("./scheduler/pro-purchase-notification.scheduler");

const {
  startDeliveryRecoveryScheduler,
  stopDeliveryRecoveryScheduler,
} = require("./scheduler/delivery-recovery.scheduler");

const { createDownloadHandler } = require("./handlers/download.handler");
const { createAdminHandler } = require("./handlers/admin.handler");
const { createSuperAdminHandler } = require("./handlers/super-admin.handler");
const { createInstagramCookieHandler } = require("./handlers/instagram-cookie.handler");

const {
  createZekaMediaHandler,
} = require("./handlers/zeka-media.handler");

const {
  createQuizHandler,
  cleanupQuizTimers,
} = require("./games/quiz/quiz.handler");

const { recoverJobs } = require("./services/queue-recovery.service");
const { recoverDeliveredJobs } = require("./services/delivery-recovery.service");
const { createFortuneHandler } = require("./handlers/fortune.handler");

// سیستم پشتیبانی کاربران
const { createSupportHandler } = require("./handlers/support.handler");

let bot = null;

// تنظیم اتصال خروجی به Telegram API
const telegramAgent = new https.Agent({
  keepAlive: false,
  family: 4,
  timeout: 120000,
});

function createBot() {
  if (bot) {
    return bot;
  }

  if (!config.bot.token) {
    throw new Error("BOT_TOKEN is not configured");
  }

  bot = new Telegraf(config.bot.token, {
    handlerTimeout: 180_000,

    telegram: {
      agent: telegramAgent,
    },
  });

  bot.catch((error, ctx) => {
    console.error("Telegram update handler failed:", {
      updateId: ctx?.update?.update_id,
      updateType: ctx?.updateType,
      errorCode: error?.response?.error_code,
      retryAfter: error?.response?.parameters?.retry_after,
      message: error?.message,
    });
  });

  bot.use(async (ctx, next) => {
    console.log(
      "TELEGRAM UPDATE RECEIVED:",
      ctx.update?.update_id,
      ctx.updateType,
      ctx.from?.id,
      ctx.message?.text ? "[redacted]" : ""
    );

    return next();
  });

  // جلوگیری از دسترسی کاربران مسدودشده
  bot.use(userBlockMiddleware);

  setDeliveryBot(bot);
  setReportBot(bot);
  setZekaMediaBot(bot);

  createQuizHandler({
    bot,
    gamesMenu,
  });

  createAdminHandler(bot);
  createSuperAdminHandler(bot);
  createZekaMediaHandler(bot);
  createInstagramCookieHandler(bot);

  // ثبت سیستم پشتیبانی کاربران
  createSupportHandler({ bot });

  createBasicHandler({
    bot,
    mainMenu,
  });

  createWebLoginHandler({ bot });

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

  createDownloadHandler({
    bot,
    mainMenu,
    downloadMenu,
  });

  createNavigationHandler({
    bot,
    mainMenu,
  });

  register(async () => {
    stopScheduledPublishing();
    stopProPurchaseNotificationScheduler();
    stopDeliveryRecoveryScheduler();
    stopZekaMediaExpirationService();

    cleanupQuizTimers();

    if (bot) {
      await bot.stop("shutdown");
    }

    telegramAgent.destroy();
  });

  register(async () => {
    await close();
  });

  return bot;
}

process.once("SIGINT", async () => {
  await shutdown("SIGINT");
});

process.once("SIGTERM", async () => {
  await shutdown("SIGTERM");
});

async function startBot() {
  const telegramBot = createBot();

  console.log("Recovering stale Zeka Media publishing items...");

  const recoveredMediaItems = await recoverStalePublishing(10);

  console.log(
    `Zeka Media recovery finished. Unknown items: ${recoveredMediaItems.length}`
  );

  startZekaMediaExpirationService();

  console.log("Starting delivery recovery...");

  await recoverDeliveredJobs();

  console.log("Delivery recovery finished.");

  startDeliveryRecoveryScheduler();

  console.log("Starting queue recovery...");

  await recoverJobs();

  console.log("Queue recovery finished.");

  startScheduledPublishing(telegramBot);

  startProPurchaseNotificationScheduler(telegramBot);

  const maxPollingConflictRetries = 12;
  let pollingStarted = false;

  for (let attempt = 1; attempt <= maxPollingConflictRetries; attempt += 1) {
    try {
      await telegramBot.launch();
      pollingStarted = true;
      console.log("Telegram bot started.");
      break;
    } catch (error) {
      const isPollingConflict =
        error?.response?.error_code === 409 &&
        String(error?.message || "").includes("getUpdates");

      if (!isPollingConflict) {
        stopScheduledPublishing();
        stopProPurchaseNotificationScheduler();
        stopDeliveryRecoveryScheduler();
        stopZekaMediaExpirationService();
        throw error;
      }

      console.error(
        `Telegram polling conflict (attempt ${attempt}/${maxPollingConflictRetries}). Retrying after deployment overlap window.`,
        error?.message || error
      );

      try {
        await telegramBot.stop("polling-conflict-retry");
      } catch (stopError) {
        // The polling loop may already have stopped after the 409 response.
      }

      if (attempt < maxPollingConflictRetries) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  if (!pollingStarted) {
    stopScheduledPublishing();
    stopProPurchaseNotificationScheduler();
    stopDeliveryRecoveryScheduler();
    stopZekaMediaExpirationService();
    throw new Error(
      `Telegram polling could not start after ${maxPollingConflictRetries} conflict retries.`
    );
  }
}

module.exports = {
  createBot,
  startBot,
};
