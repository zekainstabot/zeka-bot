
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

  const maxTelegramStartupRetries = 12;
  let telegramStarted = false;

  for (let attempt = 1; attempt <= maxTelegramStartupRetries; attempt += 1) {
    try {
      await telegramBot.launch();
      telegramStarted = true;
      console.log("Telegram bot started.");
      break;
    } catch (error) {
      const errorCode = error?.response?.error_code;
      const networkCode = error?.code || error?.cause?.code;
      const message = String(error?.message || "");
      const isPollingConflict =
        errorCode === 409 && message.includes("getUpdates");
      const isTemporaryNetworkError =
        ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "ECONNREFUSED", "EPIPE"].includes(networkCode) ||
        error?.type === "system" ||
        /network|fetch failed|socket hang up|connection reset/i.test(message);

      if (!isPollingConflict && !isTemporaryNetworkError) {
        stopScheduledPublishing();
        stopProPurchaseNotificationScheduler();
        stopDeliveryRecoveryScheduler();
        stopZekaMediaExpirationService();
        throw error;
      }

      const retryDelayMs = Math.min(5000 * attempt, 30000);
      console.error(
        `Telegram startup temporarily failed (attempt ${attempt}/${maxTelegramStartupRetries}). Retrying in ${Math.round(retryDelayMs / 1000)}s.`,
        {
          errorCode: errorCode || null,
          networkCode: networkCode || null,
          message,
        }
      );

      try {
        await telegramBot.stop("startup-retry");
      } catch (stopError) {
        // Polling may not have started.
      }

      if (attempt < maxTelegramStartupRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  if (!telegramStarted) {
    stopScheduledPublishing();
    stopProPurchaseNotificationScheduler();
    stopDeliveryRecoveryScheduler();
    stopZekaMediaExpirationService();
    throw new Error(
      `Telegram could not start after ${maxTelegramStartupRetries} attempts due to repeated network or polling conflicts.`
    );
  }
}

module.exports = {
  createBot,
  startBot,
};
