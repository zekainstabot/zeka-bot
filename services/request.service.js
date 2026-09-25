const requestRepository = require("../repositories/request.repository");
const { createAndQueueJob } = require("../queue/service");

async function createDownloadRequest({
  userId,
  platform,
  originalUrl,
  normalizedUrl,
  requestType = "DOWNLOAD",
  estimatedCost = null,
  isHeavy = false,
  priority = 0,
}) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!platform) {
    throw new Error("Platform is required");
  }

  if (!originalUrl) {
    throw new Error("Original URL is required");
  }

  const finalNormalizedUrl =
    normalizedUrl || originalUrl;

  const activeRequest =
    await requestRepository.findActiveByUserAndUrl(
      userId,
      finalNormalizedUrl
    );

  if (activeRequest) {
    const error = new Error(
      "An active request already exists for this URL"
    );

    error.code = "DUPLICATE_ACTIVE_REQUEST";
    error.request = activeRequest;

    throw error;
  }

  const request = await requestRepository.create({
    userId,
    platform,
    originalUrl,
    normalizedUrl: finalNormalizedUrl,
    requestType,
    estimatedCost,
    isHeavy,
    status: "WAITING",
  });

  try {
    const job = await createAndQueueJob({
      request,
      contentType: requestType,
      priority,
      isHeavy,
    });

    return {
      request,
      job,
    };
  } catch (error) {
    console.error(
      `Failed to create job for request: ${
        request.request_id || request.id
      }`,
      error
    );

    try {
      await requestRepository.update(
        request.id,
        {
          status: "FAILED",
          error_code: "JOB_CREATION_FAILED",
          error_message:
            error instanceof Error
              ? error.message
              : String(
                  error || "Failed to create job"
                ),
        }
      );
    } catch (requestError) {
      console.error(
        `Failed to update request status: ${
          request.request_id || request.id
        }`,
        requestError
      );
    }

    throw error;
  }
}

async function getRequestById(id) {
  if (!id) return null;

  return requestRepository.findById(id);
}

async function getRequestByRequestId(requestId) {
  if (!requestId) return null;

  return requestRepository.findByRequestId(
    requestId
  );
}

async function updateRequestStatus(id, status) {
  if (!id) {
    throw new Error("Request ID is required");
  }

  if (!status) {
    throw new Error("Request status is required");
  }

  return requestRepository.updateStatus(
    id,
    status
  );
}

module.exports = {
  createDownloadRequest,
  getRequestById,
  getRequestByRequestId,
  updateRequestStatus,
};
