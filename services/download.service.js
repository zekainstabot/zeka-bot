const jobRepository = require("../repositories/job.repository");
const requestRepository = require("../repositories/request.repository");
const { getPool } = require("../database/pool");

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

  const pool = getPool();
  const client = await pool.connect();

  const completedAt = new Date();
  const finalCost = data.finalCost ?? null;

  try {
    await client.query("BEGIN");

    const job = await jobRepository.update(
      jobId,
      {
        status: "COMPLETED",
        completed_at: completedAt,
        final_cost: finalCost,
      },
      client
    );

    if (!job) {
      throw new Error(
        `Job not found while completing: ${jobId}`
      );
    }

    if (job.request_id) {
      const request = await requestRepository.update(
        job.request_id,
        {
          status: "COMPLETED",
          final_cost: finalCost,
          completed_at: completedAt,
        },
        client
      );

      if (!request) {
        throw new Error(
          `Request not found while completing job: ${jobId}`
        );
      }
    }

    await client.query("COMMIT");

    return job;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Failed to rollback job completion transaction:",
        rollbackError
      );
    }

    throw error;
  } finally {
    client.release();
  }
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
