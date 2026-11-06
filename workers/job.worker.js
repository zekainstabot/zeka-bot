const userRepository = require("../repositories/user.repository");

const {
  downloadInstagram,
} = require("../services/instagram.service");

const {
  downloadTikTok,
} = require("../services/tiktok.service");

const {
  sendFileToUser,
} = require("../services/delivery.service");

const deliveryRepository =
  require("../repositories/job.delivery.repository");

const mediaRepository =
  require("../repositories/zeka-media.repository");

const {
  enqueueForReview,
} = require("../services/zeka-media.service");

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

const defaultDependencies = {
  userRepository,
  downloadInstagram,
  downloadTikTok,
  sendFileToUser,
  deliveryRepository,
  mediaRepository,
  enqueueForReview,
  markSending,
  markCompleted,
  markFailed,
  deleteFile,
  consumeCredit,
  releaseCredit,
};

function createJobWorker(overrides = {}) {
  const deps = {
    ...defaultDependencies,
    ...overrides,
  };

  async function processJob(job) {
    if (!job || !job.id) {
      throw new Error("Valid job is required");
    }

    const jobLabel = job.job_id || job.id;

    console.log(`Worker started job: ${jobLabel}`);

    let downloadedFilePath = null;
    let creditConsumed = false;
    let deliveryStarted = false;
    let deliveryConfirmed = false;
    let deliveryUnknown = false;
    let preserveDownloadedFile = false;

    const reservedCost = Number(job.reserved_cost || 0);

    const consumeCreditForJob =
      Number.isFinite(reservedCost) && reservedCost > 0;

    try {
      let result;

      if (job.platform === "instagram") {
        result = await deps.downloadInstagram(job);
      } else if (job.platform === "tiktok") {
        result = await deps.downloadTikTok(job);
      } else {
        throw new Error(`Unsupported platform: ${job.platform}`);
      }

      if (!result?.success) {
        throw new Error(result?.reason || "Download failed");
      }

      downloadedFilePath = result.filePath;

      const user = await deps.userRepository.findById(job.user_id);

      if (!user) {
        throw new Error(`User not found: ${job.user_id}`);
      }

      await deps.markSending(job.id);

      const caption =
        result.caption && result.caption.trim()
          ? result.caption.trim()
          : "🤖 Zeka";

      await deps.deliveryRepository.createPending({
        jobId: job.id,
        telegramChatId: user.telegram_user_id,
      });

      deliveryStarted = true;

      const deliveryResult = await deps.sendFileToUser({
        telegramUserId: user.telegram_user_id,
        filePath: result.filePath,
        caption,
        contentType: result.contentType,
      });

      const telegramMessageId =
        deliveryResult?.response?.result?.message_id ?? null;

      if (!telegramMessageId) {
        await deps.deliveryRepository.markUnknown(job.id);
        deliveryUnknown = true;

        throw new Error(
          "Telegram delivery succeeded without a message_id"
        );
      }

      await deps.deliveryRepository.markSent(
        job.id,
        telegramMessageId
      );

      deliveryConfirmed = true;

      if (consumeCreditForJob) {
        await deps.consumeCredit(job.id);
        creditConsumed = true;
      }

      try {
        const queueItem = await deps.enqueueForReview({
          jobId: job.id,
          filePath: result.filePath,
          contentType: result.contentType,
          originalUrl:
            result.sourceUrl ||
            job.normalized_url ||
            job.original_url ||
            null,
          caption: result.caption || "",
        });

        if (
          queueItem &&
          [
            "PENDING",
            "PUBLISHING",
            "PUBLISH_UNKNOWN",
          ].includes(queueItem.status) &&
          queueItem.file_path === result.filePath
        ) {
          preserveDownloadedFile = true;
        }
      } catch (queueError) {
        console.error(
          `Failed to queue Zeka Media item for job ${jobLabel}:`,
          queueError
        );

        try {
          const existingItem =
            await deps.mediaRepository.findByJobId(job.id);

          if (
            existingItem &&
            [
              "PENDING",
              "PUBLISHING",
              "PUBLISH_UNKNOWN",
            ].includes(existingItem.status) &&
            existingItem.file_path === result.filePath
          ) {
            preserveDownloadedFile = true;
          }
        } catch (lookupError) {
          console.error(
            `Could not verify Zeka Media queue item for job ${jobLabel}:`,
            lookupError
          );
        }
      }

      await deps.markCompleted(job.id, {
        finalCost: consumeCreditForJob
          ? (
              result.finalCost ??
              job.reserved_cost ??
              null
            )
          : 0,
      });

      console.log(`Worker completed job: ${jobLabel}`);

      return {
        success: true,
        delivered: true,
        creditConsumed: consumeCreditForJob,
        zekaMediaQueued: preserveDownloadedFile,
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
          await deps.deliveryRepository.markUnknown(job.id);
          deliveryUnknown = true;
        } catch (deliveryError) {
          console.error(
            `Failed to mark delivery as UNKNOWN for job ${jobLabel}`,
            deliveryError
          );
        }
      }

      if (deliveryUnknown) {
        console.error(
          `Delivery state is UNKNOWN for job ${jobLabel}. Credit remains reserved and job stays in SENDING.`
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
        deliveryConfirmed &&
        consumeCreditForJob &&
        !creditConsumed
      ) {
        console.error(
          `CRITICAL: Job ${jobLabel} was delivered but credit consumption failed. Credit reservation is preserved. Job remains in SENDING for reconciliation.`,
          error
        );

        return {
          success: false,
          delivered: true,
          creditConsumed: false,
          creditPending: true,
          jobId: jobLabel,
        };
      }

      if (
        deliveryConfirmed &&
        (!consumeCreditForJob || creditConsumed)
      ) {
        console.error(
          `CRITICAL: Job ${jobLabel} was delivered and credited, but completion failed. Job remains in SENDING for recovery.`,
          error
        );

        return {
          success: false,
          delivered: true,
          creditConsumed,
          reconciliationPending: true,
          jobId: jobLabel,
        };
      }

      if (consumeCreditForJob && !creditConsumed) {
        try {
          await deps.releaseCredit(job.id);
        } catch (releaseError) {
          console.error(
            `Failed to release credit for job ${jobLabel}`,
            releaseError
          );
        }
      }

      try {
        await deps.markFailed(job.id, error, "WORKER_ERROR");
      } catch (markFailedError) {
        console.error(
          `Failed to mark job as FAILED: ${jobLabel}`,
          markFailedError
        );
      }

      throw error;
    } finally {
      if (downloadedFilePath && !preserveDownloadedFile) {
        try {
          await deps.deleteFile(downloadedFilePath);
        } catch (cleanupError) {
          console.error(
            `Failed to cleanup downloaded file for job ${jobLabel}`,
            cleanupError
          );
        }
      } else if (downloadedFilePath && preserveDownloadedFile) {
        console.log(
          `Zeka Media review file preserved for job ${jobLabel}: ${downloadedFilePath}`
        );
      }
    }
  }

  return {
    processJob,
  };
}

const {
  processJob,
} = createJobWorker();

module.exports = {
  processJob,
  createJobWorker,
};
