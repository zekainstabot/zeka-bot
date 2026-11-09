const { downloadPlatformMedia } = require("./generic-platform.downloader");
const { markDownloading, markDownloaded } = require("./download.service");

async function downloadGenericPlatform(job) {
  if (!job || !job.id) throw new Error("Valid download job is required");
  if (!job.platform) throw new Error("Download platform is required");
  const url = job.normalized_url || job.original_url;
  if (!url) throw new Error("Download URL is required");

  console.log(`${job.platform} download started: ${job.job_id || job.id}`);
  await markDownloading(job.id);

  const result = await downloadPlatformMedia({
    platform: job.platform,
    url,
    jobId: job.job_id || job.id,
  });

  if (!result?.success || !result.filePath) {
    throw new Error(result?.reason || `${job.platform} download failed`);
  }

  await markDownloaded(job.id, { contentId: null });
  return {
    success: true,
    filePath: result.filePath,
    fileSize: result.fileSize,
    contentType: result.contentType,
    sourceUrl: result.sourceUrl,
    caption: result.caption || "",
    contentId: null,
    jobId: job.job_id || job.id,
  };
}

module.exports = { downloadGenericPlatform };
