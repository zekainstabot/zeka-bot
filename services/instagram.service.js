const {
  downloadInstagramMedia,
} = require("./instagram.downloader");

const {
  markDownloading,
  markDownloaded,
} = require("./download.service");

async function downloadInstagram(job) {
  if (!job || !job.id) {
    throw new Error("Valid Instagram job is required");
  }

  if (!job.normalized_url && !job.original_url) {
    throw new Error("Instagram URL is required");
  }

  const url = job.normalized_url || job.original_url;

  console.log(
    `Instagram download started: ${job.job_id || job.id}`
  );

  await markDownloading(job.id);

  const result = await downloadInstagramMedia({
    url,
    jobId: job.job_id || job.id,
    contentType: job.content_type || "OTHER",
  });

  if (!result?.success) {
    throw new Error(
      result?.reason || "Instagram download failed"
    );
  }

  await markDownloaded(job.id, {
    contentId: result.contentId || null,
  });

  return {
    success: true,
    filePath: result.filePath,
    fileSize: result.fileSize,
    contentType: result.contentType,
    sourceUrl: result.sourceUrl,
    caption: result.caption || "",
    contentId: result.contentId || null,
    jobId: job.job_id || job.id,
  };
}

module.exports = {
  downloadInstagram,
};
