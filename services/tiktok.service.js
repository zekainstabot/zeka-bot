const {
  downloadTikTokMedia,
} = require("./tiktok.downloader");

const {
  markDownloading,
  markDownloaded,
} = require("./download.service");

async function downloadTikTok(job) {
  if (!job || !job.id) {
    throw new Error("Valid TikTok job is required");
  }

  if (!job.normalized_url && !job.original_url) {
    throw new Error("TikTok URL is required");
  }

  const url = job.normalized_url || job.original_url;

  console.log(
    `TikTok download started: ${job.job_id || job.id}`
  );

  await markDownloading(job.id);

  const result = await downloadTikTokMedia({
    url,
    jobId: job.job_id || job.id,
  });

  if (!result?.success) {
    throw new Error(
      result?.reason || "TikTok download failed"
    );
  }

  await markDownloaded(job.id, {
    contentId: null,
  });

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

module.exports = {
  downloadTikTok,
};
