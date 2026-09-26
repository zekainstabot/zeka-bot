const jobRepository = require("../repositories/job.repository");
const queueManager = require("./manager");
const {
  reserveCredit,
  releaseCredit,
} = require("../services/credit.service");

async function createAndQueueJob({
  request,
  contentType = "OTHER",
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

  const estimatedCost = Number(request.estimated_cost);

  if (!Number.isFinite(estimatedCost) || estimatedCost <= 0) {
    throw new Error("Valid request estimated cost is required");
  }

  const job = await jobRepository.create({
    requestId: request.id,
    userId: request.user_id,
    platform: request.platform,
    contentType,
    originalUrl: request.original_url,
    normalizedUrl: request.normalized_url,
    estimatedCost,
    priority,
    isHeavy,
    status: "WAITING",
  });

  let creditReserved = false;

  try {
    await reserveCredit({
      userId: request.user_id,
      amount: estimatedCost,
      requestId: request.id,
      jobId: job.id,
    });

    creditReserved = true;

    const updatedJob = await jobRepository.update(
      job.id,
      {
        reserved_cost: estimatedCost,
      }
    );

    queueManager.add(updatedJob || job);

    return updatedJob || job;
  } catch (error) {
    console.error(
      `Failed to queue job: ${job.job_id || job.id}`,
      error
    );

    if (creditReserved) {
      try {
        await releaseCredit(job.id);
      } catch (releaseError) {
        console.error(
          `Failed to release credit for job: ${
            job.job_id || job.id
          }`,
          releaseError
        );
      }
    }

    try {
      await jobRepository.updateStatus(
        job.id,
        "FAILED"
      );
    } catch (statusError) {
      console.error(
        `Failed to mark job as FAILED: ${
          job.job_id || job.id
        }`,
        statusError
      );
    }

    throw error;
  }
}

module.exports = {
  createAndQueueJob,
};
