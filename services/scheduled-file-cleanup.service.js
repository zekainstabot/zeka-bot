const fs = require("fs");
const os = require("os");
const path = require("path");

const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

const DOWNLOAD_ROOTS = [
  path.join(os.tmpdir(), "zeka-instagram"),
  path.join(os.tmpdir(), "zeka-tiktok"),
  path.join(os.tmpdir(), "zeka-scheduled-media"),
];

function calculateDirectorySize(directory) {
  let total = 0;

  let entries;

  try {
    entries = fs.readdirSync(directory, {
      withFileTypes: true,
    });
  } catch {
    return total;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    try {
      if (entry.isDirectory()) {
        total += calculateDirectorySize(fullPath);
      } else if (entry.isFile()) {
        total += fs.statSync(fullPath).size;
      }
    } catch {
      // فایل ممکن است هم‌زمان حذف شده باشد.
    }
  }

  return total;
}

async function cleanupStaleScheduledFiles() {
  const now = Date.now();
  let removedDirectories = 0;
  let removedBytes = 0;

  for (const root of DOWNLOAD_ROOTS) {
    let entries;

    try {
      entries = fs.readdirSync(root, {
        withFileTypes: true,
      });
    } catch (error) {
      if (error.code === "ENOENT") {
        continue;
      }

      console.error(
        "Scheduled cleanup could not read directory:",
        root,
        error.message
      );

      continue;
    }

    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        !entry.name.startsWith("scheduled-")
      ) {
        continue;
      }

      const directory = path.join(root, entry.name);

      try {
        const stats = fs.statSync(directory);

        if (now - stats.mtimeMs < STALE_AFTER_MS) {
          continue;
        }

        const directorySize =
          calculateDirectorySize(directory);

        fs.rmSync(directory, {
          recursive: true,
          force: true,
        });

        removedDirectories += 1;
        removedBytes += directorySize;

        console.log(
          "Removed stale scheduled media:",
          directory
        );
      } catch (error) {
        console.error(
          "Scheduled cleanup failed:",
          directory,
          error.message
        );
      }
    }
  }

  console.log(
    "Scheduled cleanup finished:",
    JSON.stringify({
      removedDirectories,
      removedBytes,
    })
  );

  return {
    removedDirectories,
    removedBytes,
  };
}

module.exports = {
  cleanupStaleScheduledFiles,
};
