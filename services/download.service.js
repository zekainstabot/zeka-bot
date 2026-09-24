const jobRepository = require("../repositories/job.repository");

async function markDownloading(jobId) {
  if (!jobId) {
    throw new Error("Job ID is required");
  }

  return jobRepository.update(jobId, {
    status: "DOWNLOADING",
  });
}

async function markDownloaded(jobId, data = {}) {
  if (!jobId) {
    throw new Error("Job ID is required");
  }

  return jobRepository.update(jobId, {
    status: "DOWNLOADED",
    content_id: data.contentId ?? null,
  });
}

async function markSending(jobId) {
  if (!jobId) {
    throw new Error("Job ID is required");
  }

  return jobRepository.update(jobId, {
    status: "SENDING",
    sending_at: new Date(),
  });
}

async function markCompleted(jobId, data = {}) {
  if (!jobId) {
    throw new Error("Job ID is required");
  }

  return jobRepository.update(jobId, {
    status: "COMPLETED",
    completed_at: new Date(),
    final_cost: data.finalCost ?? null,
  });
}

async function markFailed(jobId, error, errorCode = "DOWNLOAD_ERROR") {
  if (!jobId) {
    throw new Error("Job ID is required");
  }

  const message =
    error instanceof Error
      ? error.message
      : String(error || "Unknown error");

  return jobRepository.update(jobId, {
    status: "FAILED",
    failed_at: new Date(),
    error_code: errorCode,
    error_message: message,
  });
}

module.exports = {
  markDownloading,
  markDownloaded,
  markSending,
  markCompleted,
  markFailed,
};
