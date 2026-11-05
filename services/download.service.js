const jobRepository = require("../repositories/job.repository");
const requestRepository = require("../repositories/request.repository");
const { getPool } = require("../database/pool");

async function updateJobAndRequest(
  jobId,
  jobUpdates,
  requestUpdates
) {
  if (!jobId) {
    throw new Error("Job ID is required");
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const job = await jobRepository.update(
      jobId,
      jobUpdates,
      client
    );

    if (job && job.request_id && requestUpdates) {
      const request = await requestRepository.update(
        job.request_id,
        requestUpdates,
        client
      );

      if (!request) {
        throw new Error(
          `Request not found for job: ${jobId}`
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
        "Failed to rollback job/request update:",
        rollbackError
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

async function markDownloading(jobId) {
  const now = new Date();

  return updateJobAndRequest(
    jobId,
    {
      status: "DOWNLOADING",
      started_at: now,
      processing_at: now,
    },
    {
      status: "PROCESSING",
      started_at: now,
    }
  );
}

async function markDownloaded(jobId, data = {}) {
  return updateJobAndRequest(
    jobId,
    {
      status: "DOWNLOADED",
      content_id: data.contentId ?? null,
    },
    {
      status: "PROCESSING",
    }
  );
}

async function markSending(jobId) {
  return updateJobAndRequest(
    jobId,
    {
      status: "SENDING",
      sending_at: new Date(),
    },
    {
      status: "PROCESSING",
    }
  );
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
  const message =
    error instanceof Error
      ? error.message
      : String(error || "Unknown error");

  const failedAt = new Date();

  return updateJobAndRequest(
    jobId,
    {
      status: "FAILED",
      failed_at: failedAt,
      error_code: errorCode,
      error_message: message,
    },
    {
      status: "FAILED",
      error_code: errorCode,
      error_message: message,
    }
  );
}

module.exports = {
  markDownloading,
  markDownloaded,
  markSending,
  markCompleted,
  markFailed,
};
