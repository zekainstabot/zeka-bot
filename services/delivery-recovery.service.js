const jobRepository =
  require("../repositories/job.repository");

const deliveryRepository =
  require("../repositories/job.delivery.repository");

const {
  consumeCredit,
} = require("./credit.service");

const {
  markCompleted,
} = require("./download.service");

async function recoverDeliveredJobs(limit = 100) {
  const jobs =
    await jobRepository.findSending(limit);

  if (!jobs.length) {
    return {
      recovered: 0,
      jobs: [],
    };
  }

  let recovered = 0;
  const recoveredJobs = [];

  for (const job of jobs) {
    try {
      const delivery =
        await deliveryRepository.findByJobId(
          job.id
        );

      if (!delivery) {
        console.log(
          `Delivery recovery: no delivery record for job ${
            job.job_id || job.id
          }. Leaving job in SENDING.`
        );

        continue;
      }

      if (delivery.status !== "SENT") {
        console.log(
          `Delivery recovery: job ${
            job.job_id || job.id
          } has delivery status ${delivery.status}. No resend.`
        );

        continue;
      }

      const reservedCost =
        Number(job.reserved_cost || 0);

      if (
        Number.isFinite(reservedCost) &&
        reservedCost > 0
      ) {
        await consumeCredit(
          job.id
        );
      }

      const completedJob =
        await markCompleted(
          job.id,
          {
            finalCost:
              reservedCost > 0
                ? reservedCost
                : 0,
          }
        );

      if (!completedJob) {
        throw new Error(
          "Failed to mark delivered job as completed"
        );
      }

      recovered += 1;
      recoveredJobs.push(
        completedJob
      );

      console.log(
        `Delivery recovery: job ${
          job.job_id || job.id
        } finalized without resend. Telegram message ID: ${
          delivery.telegram_message_id
        }`
      );
    } catch (error) {
      console.error(
        `Delivery recovery failed for job ${
          job.job_id || job.id
        }:`,
        error
      );
    }
  }

  return {
    recovered,
    jobs: recoveredJobs,
  };
}

module.exports = {
  recoverDeliveredJobs,
};
