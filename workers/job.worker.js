const userRepository = require("../repositories/user.repository");

const {
  downloadInstagram,
} = require("../services/instagram.service");

const {
  sendFileToUser,
} = require("../services/delivery.service");

const deliveryRepository =
  require("../repositories/job.delivery.repository");

const {
  markSending,
  markCompleted,
  markFailed,
} = require("../services/download.service");

const {
  deleteFile,
} = require("../services/file.service");

const {
  consumeCredit,
  releaseCredit,
} = require("../services/credit.service");

async function processJob(job) {
  if (!job || !job.id) {
    throw new Error("Valid job is required");
  }

  const jobLabel =
    job.job_id || job.id;

  console.log(
    `Worker started job: ${jobLabel}`
  );

  let downloadedFilePath = null;
  let creditConsumed = false;
  let deliveryStarted = false;
  let deliveryConfirmed = false;
  let deliveryUnknown = false;

  const reservedCost =
    Number(job.reserved_cost || 0);

  const consumeCreditForJob =
    Number.isFinite(reservedCost) &&
    reservedCost > 0;

  try {
    let result;

    if (job.platform === "instagram") {
      result =
        await downloadInstagram(job);
    } else {
      throw new Error(
        `Unsupported platform: ${job.platform}`
      );
    }

    if (!result?.success) {
      throw new Error(
        result?.reason ||
          "Download failed"
      );
    }

    downloadedFilePath =
      result.filePath;

    const user =
      await userRepository.findById(
        job.user_id
      );

    if (!user) {
      throw new Error(
        `User not found: ${job.user_id}`
      );
    }

    await markSending(job.id);

    const caption =
      result.caption &&
      result.caption.trim()
        ? result.caption.trim()
        : "🤖 Zeka";

    await deliveryRepository.createPending({
      jobId: job.id,
      telegramChatId:
        user.telegram_user_id,
    });

    deliveryStarted = true;

    const deliveryResult =
      await sendFileToUser({
        telegramUserId:
          user.telegram_user_id,
        filePath:
          result.filePath,
        caption,
        contentType:
          result.contentType,
      });

    const telegramMessageId =
      deliveryResult?.response?.result
        ?.message_id ?? null;

    if (!telegramMessageId) {
      await deliveryRepository.markUnknown(
        job.id
      );

      deliveryUnknown = true;

      throw new Error(
        "Telegram delivery succeeded without a message_id"
      );
    }

    await deliveryRepository.markSent(
      job.id,
      telegramMessageId
    );

    deliveryConfirmed = true;

    if (consumeCreditForJob) {
      await consumeCredit(
        job.id
      );

      creditConsumed = true;
    }

    await markCompleted(
      job.id,
      {
        finalCost:
          consumeCreditForJob
            ? (
                result.finalCost ??
                job.reserved_cost ??
                null
              )
            : 0,
      }
    );

    console.log(
      `Worker completed job: ${jobLabel}`
    );

    return {
      success: true,
      delivered: true,
      creditConsumed:
        consumeCreditForJob,
      jobId: jobLabel,
      telegramMessageId,
    };
  } catch (error) {
    console.error(
      `Worker failed job: ${jobLabel}`,
      error
    );

    if (
      deliveryStarted &&
      !deliveryConfirmed &&
      !deliveryUnknown
    ) {
      try {
        await deliveryRepository.markUnknown(
          job.id
        );

        deliveryUnknown = true;
      } catch (deliveryError) {
        console.error(
          `Failed to mark delivery as UNKNOWN for job: ${jobLabel}`,
          deliveryError
        );
      }
    }

    if (deliveryUnknown) {
      console.error(
        `Delivery state is UNKNOWN for job: ${jobLabel}. Credit will remain reserved and job will stay in SENDING.`
      );

      return {
        success: false,
        delivered: false,
        deliveryUnknown: true,
        creditConsumed: false,
        jobId: jobLabel,
      };
    }

    if (
      consumeCreditForJob &&
      !creditConsumed
    ) {
      try {
        await releaseCredit(
          job.id
        );
      } catch (releaseError) {
        console.error(
          `Failed to release credit for job: ${jobLabel}`,
          releaseError
        );
      }
    }

    try {
      await markFailed(
        job.id,
        error,
        "WORKER_ERROR"
      );
    } catch (markFailedError) {
      console.error(
        `Failed to mark job as FAILED: ${jobLabel}`,
        markFailedError
      );
    }

    throw error;
  } finally {
    if (downloadedFilePath) {
      try {
        await deleteFile(
          downloadedFilePath
        );
      } catch (cleanupError) {
        console.error(
          `Failed to cleanup downloaded file for job: ${jobLabel}`,
          cleanupError
        );
      }
    }
  }
}

module.exports = {
  processJob,
};
