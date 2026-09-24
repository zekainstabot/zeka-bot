const requestRepository = require("../repositories/request.repository");

async function createDownloadRequest({
  userId,
  platform,
  originalUrl,
  normalizedUrl,
  requestType = "DOWNLOAD",
  estimatedCost = null,
  isHeavy = false,
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

  const request = await requestRepository.create({
    userId,
    platform,
    originalUrl,
    normalizedUrl: normalizedUrl || originalUrl,
    requestType,
    estimatedCost,
    isHeavy,
    status: "WAITING",
  });

  return request;
}

async function getRequestById(id) {
  if (!id) {
    return null;
  }

  return requestRepository.findById(id);
}

async function getRequestByRequestId(requestId) {
  if (!requestId) {
    return null;
  }

  return requestRepository.findByRequestId(requestId);
}

async function updateRequestStatus(id, status) {
  if (!id) {
    throw new Error("Request ID is required");
  }

  if (!status) {
    throw new Error("Request status is required");
  }

  return requestRepository.updateStatus(id, status);
}

module.exports = {
  createDownloadRequest,
  getRequestById,
  getRequestByRequestId,
  updateRequestStatus,
};
