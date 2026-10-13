
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
      result = await downloadInstagram(job);
    } else if (job.platform === "tiktok") {
      result = await downloadTikTok(job);
    } else {
      throw new Error(`Unsupported platform: ${job.platform}`);
    }

    if (!result?.success) {
      throw new Error(result?.reason || "Download failed");
    }

    downloadedFilePath = result.filePath;

    const user = await userRepository.findById(job.user_id);

    if (!user) {
      throw new Error(`User not found: ${job.user_id}`);
    }

    await markSending(job.id);

    const caption =
      result.caption && result.caption.trim()
        ? result.caption.trim()
        : "🤖 Zeka";

    await deliveryRepository.createPending({
      jobId: job.id,
      telegramChatId: user.telegram_user_id,
    });

    deliveryStarted = true;

    const deliveryResult = await sendFileToUser({
      telegramUserId: user.telegram_user_id,
      filePath: result.filePath,
      caption,
      contentType: result.contentType,
    });

    const telegramMessageId =
      deliveryResult?.response?.result?.message_id ?? null;

    if (!telegramMessageId) {
      await deliveryRepository.markUnknown(job.id);
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
      await consumeCredit(job.id);
      creditConsumed = true;
    }

    // ثبت فایل برای بررسی ادمین؛ خطای این بخش نباید
    // دانلود موفق کاربر را به وضعیت FAILED تبدیل کند.
    try {
      const queueItem = await enqueueForReview({
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
        ["PENDING", "PUBLISHING"].includes(queueItem.status) &&
        queueItem.file_path === result.filePath
      ) {
        preserveDownloadedFile = true;
      }
    } catch (queueError) {
      console.error(
        `Failed to queue Zeka Media item for job ${jobLabel}:`,
        queueError
      );

      // اگر صف قبلاً ثبت شده باشد، فایلِ در انتظار بررسی
      // نباید به‌اشتباه پاک شود.
      try {
        const existingItem =
          await mediaRepository.findByJobId(job.id);

        if (
          existingItem &&
          ["PENDING", "PUBLISHING"].includes(
            existingItem.status
          ) &&
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

    await markCompleted(job.id, {
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
        await deliveryRepository.markUnknown(job.id);
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

    if (consumeCreditForJob && !creditConsumed) {
      try {
        await releaseCredit(job.id);
      } catch (releaseError) {
        console.error(
          `Failed to release credit for job ${jobLabel}`,
          releaseError
        );
      }
    }

    try {
      await markFailed(job.id, error, "WORKER_ERROR");
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
        await deleteFile(downloadedFilePath);
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

module.exports = {
  processJob,
};
