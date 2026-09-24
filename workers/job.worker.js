const jobRepository = require("../repositories/job.repository");
const { downloadInstagram } = require("../services/instagram.service");

async function processJob(job) {
  if (!job || !job.id) {
    throw new Error("Valid job is required");
  }

  console.log(
    `Worker started job: ${job.job_id || job.id}`
  );

  const startedAt = new Date();

  await jobRepository.update(job.id, {
    status: "PROCESSING",
    started_at: startedAt,
    processing_at: startedAt,
  });

  try {
    let result;

    if (job.platform === "instagram") {
      result = await downloadInstagram(job);
    } else {
      throw new Error(
        `Unsupported platform: ${job.platform}`
      );
    }

    if (result?.success) {
      await jobRepository.update(job.id, {
        status: "COMPLETED",
        completed_at: new Date(),
        final_cost: result.finalCost ?? null,
      });
    }

    return result;
  } catch (error) {
    await jobRepository.update(job.id, {
      status: "FAILED",
      failed_at: new Date(),
      error_code: "WORKER_ERROR",
      error_message: error.message,
    });

    throw error;
  }
}

module.exports = {
  processJob,
};
