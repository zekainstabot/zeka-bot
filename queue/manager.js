const queueConfig = require("../config/queue");
const { processJob: defaultProcessJob } = require("../workers/job.worker");

const jobs = [];

let processing = false;
let activeJobs = 0;
let processJob = defaultProcessJob;

function add(job) {
  if (!job || !job.id) {
    throw new Error("Valid job is required");
  }

  jobs.push(job);

  sortQueue();

  processNext();

  return job;
}

function sortQueue() {
  jobs.sort((a, b) => {
    const priorityA = Number(a.priority) || 0;
    const priorityB = Number(b.priority) || 0;

    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }

    return (
      new Date(a.created_at || 0).getTime() -
      new Date(b.created_at || 0).getTime()
    );
  });
}

function getLength() {
  return jobs.length;
}

function getActiveCount() {
  return activeJobs;
}

function getMaxConcurrent() {
  return queueConfig.normal.maxConcurrent;
}

function setProcessor(processor) {
  if (typeof processor !== "function") {
    throw new TypeError(
      "Queue processor must be a function"
    );
  }

  processJob = processor;
}

function resetProcessor() {
  processJob = defaultProcessJob;
}

async function processNext() {
  if (processing) {
    return;
  }

  processing = true;

  try {
    while (
      jobs.length > 0 &&
      activeJobs < queueConfig.normal.maxConcurrent
    ) {
      const job = jobs.shift();

      activeJobs += 1;

      processJob(job)
        .catch((error) => {
          console.error(
            `Queue job failed: ${job.job_id || job.id}`,
            error
          );
        })
        .finally(() => {
          activeJobs -= 1;
          processNext();
        });
    }
  } finally {
    processing = false;
  }
}

function remove(jobId) {
  const index = jobs.findIndex(
    (job) =>
      job.id === jobId ||
      job.job_id === jobId
  );

  if (index === -1) {
    return false;
  }

  jobs.splice(index, 1);

  return true;
}

function clear() {
  jobs.length = 0;
}

module.exports = {
  add,
  remove,
  clear,
  getLength,
  getActiveCount,
  getMaxConcurrent,
  setProcessor,
  resetProcessor,
  processNext,
};
