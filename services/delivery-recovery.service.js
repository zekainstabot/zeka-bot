const jobRepository = require("../repositories/job.repository");
const deliveryRepository = require("../repositories/job.delivery.repository");

const {
  consumeCredit,
} = require("./credit.service");

const {
  markCompleted,
} = require("./download.service");

const {
  getPool,
} = require("../database/pool");

const RECOVERY_LOCK_ID = 724198331002;

function createDeliveryRecoveryService(dependencies = {}) {
  const jobs = dependencies.jobRepository || jobRepository;
  const deliveries =
    dependencies.deliveryRepository || deliveryRepository;
  const consume =
    dependencies.consumeCredit || consumeCredit;
  const complete =
    dependencies.markCompleted || markCompleted;
  const poolProvider = dependencies.getPool || getPool;

  return async function recoverDeliveredJobs(limit = 100) {
    const pool = poolProvider();
    const lockClient = await pool.connect();

    let lockAcquired = false;

    try {
      const lockResult = await lockClient.query(
        "SELECT pg_try_advisory_lock($1) AS locked",
        [RECOVERY_LOCK_ID]
      );

      lockAcquired = lockResult.rows[0]?.locked === true;

      if (!lockAcquired) {
        return {
          recovered: 0,
          jobs: [],
          skipped: true,
        };
      }

      const sendingJobs = await jobs.findSending(limit);

      if (!sendingJobs.length) {
        return {
          recovered: 0,
          jobs: [],
        };
      }

      let recovered = 0;
      const recoveredJobs = [];

      for (const job of sendingJobs) {
        try {
          const delivery = await deliveries.findByJobId(job.id);

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

          const reservedCost = Number(job.reserved_cost || 0);

          if (!Number.isFinite(reservedCost) || reservedCost < 0) {
            throw new Error(
              `Invalid reserved cost for job ${job.job_id || job.id}`
            );
          }

          if (reservedCost > 0) {
            await consume(job.id);
          }

          const completedJob = await complete(job.id, {
            finalCost: reservedCost,
          });

          if (!completedJob) {
            throw new Error(
              "Failed to mark delivered job as completed"
            );
          }

          recovered += 1;
          recoveredJobs.push(completedJob);

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
    } finally {
      if (lockAcquired) {
        try {
          await lockClient.query(
            "SELECT pg_advisory_unlock($1)",
            [RECOVERY_LOCK_ID]
          );
        } catch (unlockError) {
          console.error(
            "Failed to release delivery recovery lock:",
            unlockError
          );
        }
      }

      lockClient.release();
    }
  };
}

const recoverDeliveredJobs = createDeliveryRecoveryService();

module.exports = {
  recoverDeliveredJobs,
  createDeliveryRecoveryService,
};
