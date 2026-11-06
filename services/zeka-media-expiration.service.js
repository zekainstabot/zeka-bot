const mediaRepository = require("../repositories/zeka-media.repository");
const {
  deleteFile,
  fileExists,
} = require("./file.service");

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 100;

let expirationInterval = null;
let expirationRunning = false;

async function expireOldMedia() {
  if (expirationRunning) return;

  expirationRunning = true;

  try {
    const expiredItems = await mediaRepository.expirePending();

    const cleanupItems =
      await mediaRepository.listExpiredFilesForCleanup(
        CLEANUP_BATCH_SIZE
      );

    let deletedCount = 0;
    let failedCount = 0;

    for (const item of cleanupItems) {
      try {
        const exists = await fileExists(item.file_path);

        if (exists) {
          const deleted = await deleteFile(item.file_path);

          if (!deleted) {
            failedCount += 1;

            console.error(
              `Zeka Media file cleanup failed for item ${item.id}. Will retry later.`
            );

            continue;
          }
        }

        const marked = await mediaRepository.markFileDeleted(
          item.id
        );

        if (!marked) {
          failedCount += 1;

          console.error(
            `Could not mark Zeka Media file as deleted for item ${item.id}.`
          );

          continue;
        }

        deletedCount += 1;

        console.log(
          `Zeka Media item ${item.id} file cleanup completed.`
        );
      } catch (error) {
        failedCount += 1;

        console.error(
          `Failed to clean up Zeka Media item ${item.id}:`,
          error.message
        );
      }
    }

    console.log(
      "Zeka Media expiration finished:",
      JSON.stringify({
        newlyExpired: expiredItems.length,
        cleanupChecked: cleanupItems.length,
        cleanupCompleted: deletedCount,
        cleanupFailed: failedCount,
      })
    );
  } catch (error) {
    console.error(
      "Zeka Media expiration service failed:",
      error
    );
  } finally {
    expirationRunning = false;
  }
}

function startZekaMediaExpirationService() {
  if (expirationInterval) return;

  console.log(
    "Zeka Media expiration service started; checking every 15 minutes."
  );

  void expireOldMedia();

  expirationInterval = setInterval(() => {
    void expireOldMedia();
  }, CHECK_INTERVAL_MS);

  if (typeof expirationInterval.unref === "function") {
    expirationInterval.unref();
  }
}

function stopZekaMediaExpirationService() {
  if (!expirationInterval) return;

  clearInterval(expirationInterval);
  expirationInterval = null;
}

module.exports = {
  expireOldMedia,
  startZekaMediaExpirationService,
  stopZekaMediaExpirationService,
};
