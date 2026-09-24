const queueConfig = require("../config/queue");

const jobs = [];
let processing = false;
let activeJobs = 0;

function add(job) {
  if (!job || !job.id) {
    throw new Error("Valid job is required");
  }

  jobs.push(job);

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

  processNext();

  return job;
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

      executeJob(job)
        .catch((error) => {
          console.error("Queue job failed:", error);
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

async function executeJob(job) {
  console.log(
    `Queue processing started: ${job.job_id || job.id}`
  );

  if (typeof job.handler === "function") {
    return job.handler(job);
  }

  console.log(
    `Queue job has no handler yet: ${job.job_id || job.id}`
  );

  return job;
}

function remove(jobId) {
  const index = jobs.findIndex(
    (job) => job.id === jobId || job.job_id === jobId
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
  processNext,
};
