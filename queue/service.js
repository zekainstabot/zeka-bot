const jobRepository = require("../repositories/job.repository");
const queueManager = require("./manager");

async function createAndQueueJob({
  request,
  contentType = "DOWNLOAD",
  priority = 0,
  isHeavy = false,
}) {
  if (!request || !request.id) {
    throw new Error("Valid request is required");
  }

  if (!request.user_id) {
    throw new Error("Request user ID is required");
  }

  if (!request.original_url) {
    throw new Error("Request original URL is required");
  }

  const job = await jobRepository.create({
    requestId: request.id,
    userId: request.user_id,
    platform: request.platform,
    contentType,
    originalUrl: request.original_url,
    normalizedUrl: request.normalized_url,
    estimatedCost: request.estimated_cost,
    priority,
    isHeavy,
    status: "WAITING",
  });

  queueManager.add(job);

  return job;
}

async function getJobById(id) {
  if (!id) {
    return null;
  }

  return jobRepository.findById(id);
}

async function getJobByJobId(jobId) {
  if (!jobId) {
    return null;
  }

  return jobRepository.findByJobId(jobId);
}

async function getJobsByRequestId(requestId) {
  if (!requestId) {
    return [];
  }

  return jobRepository.findByRequestId(requestId);
}

async function cancelJob(id) {
  if (!id) {
    throw new Error("Job ID is required");
  }

  const removed = queueManager.remove(id);

  const job = await jobRepository.updateStatus(
    id,
    "CANCELLED"
  );

  return {
    job,
    removedFromQueue: removed,
  };
}

module.exports = {
  createAndQueueJob,
  getJobById,
  getJobByJobId,
  getJobsByRequestId,
  cancelJob,
};
