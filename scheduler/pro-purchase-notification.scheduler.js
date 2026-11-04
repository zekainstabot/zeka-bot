
const notificationService = require(
  "../services/pro-purchase-notification.service"
);

const POLL_INTERVAL_MS = 15_000;
const BATCH_SIZE = 10;

let schedulerTimer = null;
let isRunning = false;
let botInstance = null;

async function processNotifications() {
  if (isRunning || !botInstance) {
    return;
  }

  isRunning = true;

  try {
    const notifications =
      await notificationService.claimNotifications(
        BATCH_SIZE
      );

    for (const notification of notifications) {
      try {
        await botInstance.telegram.sendMessage(
          notification.telegram_user_id,
          notification.message
        );

        await notificationService.markNotificationSent(
          notification.id
        );

        console.log(
          `Pro notification ${notification.id} sent successfully.`
        );
      } catch (error) {
        console.error(
          `Pro notification ${notification.id} failed:`,
          error.message
        );

        try {
          await notificationService.markNotificationFailed(
            notification.id,
            notification.attempts,
            error
          );
        } catch (updateError) {
          console.error(
            `Could not schedule retry for notification ${notification.id}:`,
            updateError
          );
        }
      }
    }
  } catch (error) {
    console.error(
      "Pro purchase notification scheduler failed:",
      error
    );
  } finally {
    isRunning = false;
  }
}

function startProPurchaseNotificationScheduler(bot) {
  if (!bot || !bot.telegram) {
    throw new Error(
      "Telegram bot must be initialized before starting Pro notification scheduler."
    );
  }

  if (schedulerTimer) {
    return;
  }

  botInstance = bot;

  console.log(
    `Pro purchase notification scheduler started. Poll interval: ${POLL_INTERVAL_MS}ms.`
  );

  processNotifications();

  schedulerTimer = setInterval(
    processNotifications,
    POLL_INTERVAL_MS
  );
}

function stopProPurchaseNotificationScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }

  botInstance = null;

  console.log(
    "Pro purchase notification scheduler stopped."
  );
}

module.exports = {
  startProPurchaseNotificationScheduler,
  stopProPurchaseNotificationScheduler,
};
