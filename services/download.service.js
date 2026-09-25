const jobRepository = require("../repositories/job.repository");
const requestRepository = require("../repositories/request.repository");

async function updateRequest(jobId, updates) {
  const job = await jobRepository.findById(jobId);

  if (!job || !job.request_id) {
    return null;
  }

  return requestRepository.update(
    job.request_id,
    updates
  );
}

async function markDownloading(jobId) {
  if (!jobId) {
    throw new Error("Job ID is required");
  }

  const now = new Date();

  const job = await jobRepository.update(jobId, {
    status: "DOWNLOADING",
    started_at: now,
    processing_at: now,
  });

  await updateRequest(jobId, {
    status: "PROCESSING",
    started_at: now,
  });

  return job;
}

async function markDownloaded(jobId, data = {}) {
  if (!jobId) {
    throw new Error("Job ID is required");
  }

  const job = await jobRepository.update(jobId, {
    status: "DOWNLOADED",
    content_id: data.contentId ?? null,
  });

  await updateRequest(jobId, {
    status: "PROCESSING",
  });

  return job;
}

async function markSending(jobId) {
  if (!jobId) {
    throw new Error("Job ID is required");
  }

  const job = await jobRepository.update(jobId, {
    status: "SENDING",
    sending_at: new Date(),
  });

  await updateRequest(jobId, {
    status: "PROCESSING",
  });

  return job;
}

async function markCompleted(jobId, data = {}) {
  if (!jobId) {
    throw new Error("Job ID is required");
  }

  const completedAt = new Date();

  const job = await jobRepository.update(jobId, {
    status: "COMPLETED",
    completed_at: completedAt,
    final_cost: data.finalCost ?? null,
  });

  await updateRequest(jobId, {
    status: "COMPLETED",
    final_cost: data.finalCost ?? null,
    completed_at: completedAt,
  });

  return job;
}

async function markFailed(
  jobId,
  error,
  errorCode = "DOWNLOAD_ERROR"
) {
  if (!jobId) {
    throw new Error("Job ID is required");
  }

  const message =
    error instanceof Error
      ? error.message
      : String(error || "Unknown error");

  const failedAt = new Date();

  const job = await jobRepository.update(jobId, {
    status: "FAILED",
    failed_at: failedAt,
    error_code: errorCode,
    error_message: message,
  });

  await updateRequest(jobId, {
    status: "FAILED",
    error_code: errorCode,
    error_message: message,
  });

  return job;
}

module.exports = {
  markDownloading,
  markDownloaded,
  markSending,
  markCompleted,
  markFailed,
};
