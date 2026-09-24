const jobRepository = require("../repositories/job.repository");
const {
  downloadInstagramMedia,
} = require("./instagram.downloader");

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

  await jobRepository.update(job.id, {
    status: "DOWNLOADING",
  });

  const result = await downloadInstagramMedia({
    url,
    jobId: job.job_id || job.id,
  });

  if (!result.success) {
    throw new Error(
      result.reason || "Instagram download failed"
    );
  }

  await jobRepository.update(job.id, {
    status: "DOWNLOADED",
  });

  return {
    success: true,
    filePath: result.filePath,
    fileSize: result.fileSize,
    contentType: result.contentType,
    sourceUrl: result.sourceUrl,
    jobId: job.job_id || job.id,
  };
}

module.exports = {
  downloadInstagram,
};
