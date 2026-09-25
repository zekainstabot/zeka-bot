const jobRepository = require("../repositories/job.repository");
const requestRepository = require("../repositories/request.repository");

async function updateRequestStatus(jobId, status) {
  const job = await jobRepository.findById(jobId);

  if (!job || !job.request_id) {
    return null;
  }

  return requestRepository.updateStatus(
    job.request_id,
    status
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

  await updateRequestStatus(jobId, "PROCESSING");

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

  await updateRequestStatus(jobId, "PROCESSING");

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

  await updateRequestStatus(jobId, "PROCESSING");

  return job;
}

async function markCompleted(jobId, data = {}) {
  if (!jobId) {
    throw new Error("Job ID is required");
  }

  const job = await jobRepository.update(jobId, {
    status: "COMPLETED",
    completed_at: new Date(),
    final_cost: data.finalCost ?? null,
  });

  await updateRequestStatus(jobId, "COMPLETED");

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

  const job = await jobRepository.update(jobId, {
    status: "FAILED",
    failed_at: new Date(),
    error_code: errorCode,
    error_message: message,
  });

  await updateRequestStatus(jobId, "FAILED");

  return job;
}

module.exports = {
  markDownloading,
  markDownloaded,
  markSending,
  markCompleted,
  markFailed,
};
