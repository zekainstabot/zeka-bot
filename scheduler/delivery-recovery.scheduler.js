const {
  recoverDeliveredJobs,
} = require("../services/delivery-recovery.service");

const POLL_INTERVAL_MS = 30_000;
const BATCH_SIZE = 100;

let schedulerTimer = null;
let isRunning = false;

async function processDeliveryRecovery() {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const result = await recoverDeliveredJobs(BATCH_SIZE);

    if (result.recovered > 0) {
      console.log(
        `Delivery recovery scheduler: ${result.recovered} job(s) recovered.`
      );
    }
  } catch (error) {
    console.error(
      "Delivery recovery scheduler failed:",
      error
    );
  } finally {
    isRunning = false;
  }
}

function startDeliveryRecoveryScheduler() {
  if (schedulerTimer) {
    console.log(
      "Delivery recovery scheduler is already running."
    );
    return;
  }

  console.log(
    `Delivery recovery scheduler started. Poll interval: ${POLL_INTERVAL_MS}ms.`
  );

  schedulerTimer = setInterval(
    processDeliveryRecovery,
    POLL_INTERVAL_MS
  );
}

function stopDeliveryRecoveryScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }

  console.log(
    "Delivery recovery scheduler stopped."
  );
}

module.exports = {
  startDeliveryRecoveryScheduler,
  stopDeliveryRecoveryScheduler,
  processDeliveryRecovery,
};
