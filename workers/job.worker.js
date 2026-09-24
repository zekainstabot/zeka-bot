const userRepository = require("../repositories/user.repository");

const {
  downloadInstagram,
} = require("../services/instagram.service");

const {
  sendFileToUser,
} = require("../services/delivery.service");

const {
  markSending,
  markCompleted,
  markFailed,
} = require("../services/download.service");

const {
  deleteFile,
} = require("../services/file.service");

async function processJob(job) {
  if (!job || !job.id) {
    throw new Error("Valid job is required");
  }

  console.log(
    `Worker started job: ${job.job_id || job.id}`
  );

  let downloadedFilePath = null;

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

    await markCompleted(job.id, {
      finalCost: result.finalCost ?? null,
    });

    return {
      success: true,
      delivered: true,
      jobId: job.job_id || job.id,
    };
  } catch (error) {
    await markFailed(
      job.id,
      error,
      "WORKER_ERROR"
    );

    console.error(
      `Worker failed job: ${job.job_id || job.id}`,
      error
    );

    throw error;
  } finally {
    if (downloadedFilePath) {
      await deleteFile(downloadedFilePath);
    }
  }
}

module.exports = {
  processJob,
};
