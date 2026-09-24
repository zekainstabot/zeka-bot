const jobRepository = require("../repositories/job.repository");

async function downloadInstagram(job) {
  if (!job || !job.id) {
    throw new Error("Valid Instagram job is required");
  }

  if (!job.normalized_url && !job.original_url) {
    throw new Error("Instagram URL is required");
  }

  const url = job.normalized_url || job.original_url;

  console.log(
    `Instagram downloader started: ${job.job_id || job.id}`
  );

  await jobRepository.update(job.id, {
    status: "DOWNLOADING",
  });

  /*
   * موتور واقعی دانلود Instagram در مرحله بعد
   * به این بخش متصل می‌شود.
   *
   * خروجی استاندارد Downloader:
   *
   * {
   *   success: true,
   *   filePath: "...",
   *   contentType: "video",
   *   title: "...",
   *   sourceUrl: url
   * }
   */

  return {
    success: false,
    pending: true,
    reason: "INSTAGRAM_DOWNLOADER_ENGINE_NOT_CONNECTED",
    jobId: job.job_id || job.id,
    sourceUrl: url,
  };
}

module.exports = {
  downloadInstagram,
};
