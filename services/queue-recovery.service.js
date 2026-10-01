const jobRepository = require("../repositories/job.repository");
const queueManager = require("../queue/manager");

async function recoverJobs(limit = 100) {
  const jobs = await jobRepository.findRecoverable(limit);

  if (!jobs.length) {
    console.log(
      "Queue recovery: no recoverable jobs found."
    );

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
        `Queue recovery: job ${
          job.job_id || job.id
        } restored from ${job.status}.`
      );
    } catch (error) {
      console.error(
        `Queue recovery failed for job ${
          job.job_id || job.id
        }:`,
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
  recoverJobs,
};
