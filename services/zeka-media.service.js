const fs = require("fs");

const mediaRepository = require("../repositories/zeka-media.repository");

let botInstance = null;

function setBot(bot) {
  botInstance = bot;
}

async function enqueueForReview({
  jobId,
  filePath,
  contentType,
  originalUrl,
}) {
  const numericJobId = Number(jobId);

  if (
    !Number.isSafeInteger(numericJobId) ||
    numericJobId <= 0
  ) {
    throw new Error(
      "A valid numeric database job ID is required"
    );
  }

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(
      "Cannot queue a missing media file"
    );
  }

  const queueItem = await mediaRepository.createPending({
    jobId: numericJobId,
    filePath,
    contentType,
    originalUrl,
  });

  if (!queueItem) {
    throw new Error(
      "Could not create Zeka Media queue item"
    );
  }

  return queueItem;
}

module.exports = {
  setBot,
  enqueueForReview,
};
