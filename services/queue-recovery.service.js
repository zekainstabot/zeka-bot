const jobRepository = require("../repositories/job.repository");
const queueManager = require("../queue/manager");

async function recoverWaitingJobs(limit = 100) {
  const jobs = await jobRepository.findPending(limit);

  if (!jobs.length) {
    console.log("Queue recovery: no waiting jobs found.");
    return {
      recovered: 0,
      jobs: [],
    };
  }

  let recovered = 0;
  const recoveredJobs = [];

  for (const job of jobs) {
    try {
      queueManager.add(job);

      recovered += 1;
      recoveredJobs.push(job);

      console.log(
        `Queue recovery: job ${job.job_id || job.id} restored.`
      );
    } catch (error) {
      console.error(
        `Queue recovery failed for job ${job.job_id || job.id}:`,
        error
      );
    }
  }

  console.log(
    `Queue recovery complete: ${recovered}/${jobs.length} jobs restored.`
  );

  return {
    recovered,
    jobs: recoveredJobs,
  };
}

module.exports = {
  recoverWaitingJobs,
};
