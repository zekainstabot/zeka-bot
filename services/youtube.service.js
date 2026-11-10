const { downloadYouTubeMedia } = require("./youtube.downloader");
const { markDownloading, markDownloaded } = require("./download.service");

async function downloadYouTube(job) {
  if (!job || !job.id) throw new Error("Valid YouTube job is required");
  if (!job.normalized_url && !job.original_url) throw new Error("YouTube URL is required");

  const url = job.normalized_url || job.original_url;
  console.log(`YouTube download started: ${job.job_id || job.id}`);
  await markDownloading(job.id);

  const result = await downloadYouTubeMedia({
    url,
    jobId: job.job_id || job.id,
    audioOnly: String(job.content_type || "").toUpperCase() === "AUDIO",
  });

  if (!result?.success || !result.filePath) {
    throw new Error(result?.reason || "YouTube download failed");
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

module.exports = { downloadYouTube };
