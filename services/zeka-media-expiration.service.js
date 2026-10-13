
const mediaRepository = require("../repositories/zeka-media.repository");
const { deleteFile } = require("./file.service");

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

let expirationInterval = null;
let expirationRunning = false;

async function expireOldMedia() {
  if (expirationRunning) return;

  expirationRunning = true;

  try {
    const expiredItems = await mediaRepository.expirePending();

    if (!expiredItems.length) return;

    let deletedCount = 0;
    let failedCount = 0;

    for (const item of expiredItems) {
      try {
        if (item.file_path) {
          await deleteFile(item.file_path);
        }

        deletedCount += 1;

        console.log(
          `Zeka Media item ${item.id} expired; file cleanup completed.`
        );
      } catch (error) {
        failedCount += 1;

        console.error(
          `Failed to delete expired Zeka Media file for item ${item.id}:`,
          error.message
        );
      }
    }

    console.log(
      "Zeka Media expiration finished:",
      JSON.stringify({
        expiredItems: expiredItems.length,
        deletedCount,
        failedCount,
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
