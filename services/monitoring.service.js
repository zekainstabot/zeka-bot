const { getClient } = require("../database/client");
const queueManager = require("../queue/manager");

async function getMonitoringData() {
  const db = getClient();

  const [
    usersResult,
    activeUsersResult,
    requestsResult,
    waitingJobsResult,
    processingJobsResult,
    failedJobsResult,
    completedJobsResult,
  ] = await Promise.all([
    db.query(`
      SELECT COUNT(*)::int AS count
      FROM users
    `),

    db.query(`
      SELECT COUNT(*)::int AS count
      FROM users
      WHERE last_active_at >= NOW() - INTERVAL '24 hours'
    `),

    db.query(`
      SELECT COUNT(*)::int AS count
      FROM requests
    `),

    db.query(`
      SELECT COUNT(*)::int AS count
      FROM jobs
      WHERE status = 'WAITING'
    `),

    db.query(`
      SELECT COUNT(*)::int AS count
      FROM jobs
      WHERE status IN (
        'PROCESSING',
        'DOWNLOADING',
        'SENDING'
      )
    `),

    db.query(`
      SELECT COUNT(*)::int AS count
      FROM jobs
      WHERE status = 'FAILED'
    `),

    db.query(`
      SELECT COUNT(*)::int AS count
      FROM jobs
      WHERE status = 'COMPLETED'
    `),
  ]);

  const queueWaiting = queueManager.getLength();
  const queueActive = queueManager.getActiveCount();
  const queueCapacity = queueManager.getMaxConcurrent();

  let database = "🟢 متصل";

  try {
    await db.query("SELECT 1");
  } catch (error) {
    database = "🔴 قطع";

    console.error(
      "Monitoring database check failed:",
      error
    );
  }

  return {
    users: usersResult.rows[0].count,
    activeUsers: activeUsersResult.rows[0].count,
    requests: requestsResult.rows[0].count,
    waitingJobs: waitingJobsResult.rows[0].count,
    processingJobs: processingJobsResult.rows[0].count,
    failedJobs: failedJobsResult.rows[0].count,
    completedJobs: completedJobsResult.rows[0].count,
    queueWaiting,
    queueActive,
    queueCapacity,
    queueFree: Math.max(
      0,
      queueCapacity - queueActive
    ),
    database,
  };
}

module.exports = {
  getMonitoringData,
};
