const bugReportRepository = require(
  "../repositories/bug-report.repository"
);

const RETENTION_DAYS = 7;
const MAX_REPORTS = 100;
const CLEANUP_INTERVAL_MS =
  24 * 60 * 60 * 1000;

let cleanupTimer = null;

async function cleanup() {
  const result =
    await bugReportRepository.cleanupExpiredAndOverflow(
      MAX_REPORTS,
      RETENTION_DAYS
    );

  console.log(
    "Bug report cleanup completed:",
    result
  );

  return result;
}

async function start() {
  if (cleanupTimer) {
    return;
  }

  try {
    await cleanup();
  } catch (error) {
    console.error(
      "Bug report cleanup failed:",
      error
    );
  }

  cleanupTimer = setInterval(
    async () => {
      try {
        await cleanup();
      } catch (error) {
        console.error(
          "Bug report cleanup failed:",
          error
        );
      }
    },
    CLEANUP_INTERVAL_MS
  );
}

function stop() {
  if (!cleanupTimer) {
    return;
  }

  clearInterval(cleanupTimer);
  cleanupTimer = null;
}

module.exports = {
  start,
  stop,
  cleanup,
};
