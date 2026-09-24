const jobRepository = require("../repositories/job.repository");

async function processJob(job) {
  if (!job || !job.id) {
    throw new Error("Valid job is required");
  }

  console.log(
    `Worker started job: ${job.job_id || job.id}`
  );

  await jobRepository.update(job.id, {
    status: "PROCESSING",
    started_at: new Date(),
    processing_at: new Date(),
  });

  try {
    if (job.platform === "instagram") {
      return await processInstagramJob(job);
    }

    throw new Error(
      `Unsupported platform: ${job.platform}`
    );
  } catch (error) {
    await jobRepository.update(job.id, {
      status: "FAILED",
      failed_at: new Date(),
      error_code: "WORKER_ERROR",
      error_message: error.message,
    });

    throw error;
  }
}

async function processInstagramJob(job) {
  console.log(
    `Instagram job received: ${job.job_id || job.id}`
  );

  /*
   * Downloader واقعی اینستاگرام
   * در مرحله بعد به این بخش متصل می‌شود.
   */

  await jobRepository.update(job.id, {
    status: "WAITING_DOWNLOADER",
  });

  return {
    success: false,
    pending: true,
    reason: "INSTAGRAM_DOWNLOADER_NOT_CONNECTED",
    jobId: job.job_id || job.id,
  };
}

module.exports = {
  processJob,
  processInstagramJob,
};
