const userRepository = require("../repositories/user.repository");

const { downloadInstagram } = require("../services/instagram.service");
const { sendFileToUser } = require("../services/delivery.service");
const {
  markSending,
  markCompleted,
  markFailed,
} = require("../services/download.service");
const { deleteFile } = require("../services/file.service");
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
  let fileDelivered = false;
  let creditConsumed = false;

  try {
    let result;

    if (job.platform === "instagram") {
      result = await downloadInstagram(job);
    } else {
      throw new Error(
        `Unsupported platform: ${job.platform}`
      );
    }

    if (!result?.success) {
      throw new Error(
        result?.reason || "Download failed"
      );
    }

    downloadedFilePath = result.filePath;

    const user = await userRepository.findById(
      job.user_id
    );

    if (!user) {
      throw new Error(
        `User not found: ${job.user_id}`
      );
    }

    await markSending(job.id);

    await sendFileToUser({
      telegramUserId: user.telegram_user_id,
      filePath: result.filePath,
      caption:
        "✅ دانلود با موفقیت انجام شد.\n\n" +
        "🤖 Zeka",
    });

    fileDelivered = true;

    await consumeCredit(job.id);
    creditConsumed = true;

    await markCompleted(job.id, {
      finalCost: result.finalCost ?? null,
    });

    console.log(
      `Worker completed job: ${jobLabel}`
    );

    return {
      success: true,
      delivered: true,
      jobId: jobLabel,
    };
  } catch (error) {
    console.error(
      `Worker failed job: ${jobLabel}`,
      error
    );

    if (!fileDelivered && !creditConsumed) {
      try {
        await releaseCredit(job.id);
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
        await deleteFile(downloadedFilePath);
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
