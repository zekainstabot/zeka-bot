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
      const recoveredJob =
        await jobRepository.recover(job.id);

      if (!recoveredJob) {
        console.log(
          `Queue recovery: job ${
            job.job_id || job.id
          } could not be recovered.`
        );

        continue;
      }

      queueManager.add(recoveredJob);

      recovered += 1;
      recoveredJobs.push(recoveredJob);

      console.log(
        `Queue recovery: job ${
          recoveredJob.job_id ||
          recoveredJob.id
        } restored from ${job.status} to WAITING.`
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
