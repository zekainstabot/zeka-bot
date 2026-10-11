
const fs = require("fs");
const os = require("os");
const path = require("path");

const TEMP_ROOT = os.tmpdir();

const HIGH_WATERMARK_PERCENT = 50;
const LOW_WATERMARK_PERCENT = 45;
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

let cleanupRunning = false;
let cleanupInterval = null;

function getDiskUsage() {
  if (typeof fs.statfsSync !== "function") {
    throw new Error("Filesystem usage checks are not supported.");
  }

  const stats = fs.statfsSync(TEMP_ROOT);
  const totalBytes = stats.blocks * stats.bsize;
  const availableBytes = stats.bavail * stats.bsize;

  if (
    !Number.isFinite(totalBytes) ||
    !Number.isFinite(availableBytes) ||
    totalBytes <= 0
  ) {
    throw new Error("Could not determine filesystem capacity.");
  }

  const usedBytes = Math.max(0, totalBytes - availableBytes);

  return {
    totalBytes,
    usedBytes,
    availableBytes,
    usedPercent: (usedBytes / totalBytes) * 100,
  };
}

function inspectPath(targetPath) {
  let stats;

  try {
    stats = fs.lstatSync(targetPath);
  } catch {
    return null;
  }

  if (stats.isSymbolicLink()) {
    return null;
  }

  if (stats.isFile()) {
    return {
      size: stats.size,
      latestMtime: stats.mtimeMs,
    };
  }

  if (!stats.isDirectory()) {
    return null;
  }

  let size = 0;
  let latestMtime = stats.mtimeMs;
  let entries;

  try {
    entries = fs.readdirSync(targetPath);
  } catch {
    return null;
  }

  for (const name of entries) {
    const childPath = path.join(targetPath, name);
    const child = inspectPath(childPath);

    if (!child) continue;

    size += child.size;
    latestMtime = Math.max(latestMtime, child.latestMtime);
  }

  return { size, latestMtime };
}

function getCleanupCandidates() {
  let roots;

  try {
    roots = fs.readdirSync(TEMP_ROOT, {
      withFileTypes: true,
    });
  } catch (error) {
    throw new Error(
      `Could not read temporary directory: ${error.message}`
    );
  }

  const cutoff = Date.now() - STALE_AFTER_MS;
  const candidates = [];

  for (const root of roots) {
    if (!root.name.startsWith("zeka-")) continue;
    if (!root.isDirectory() || root.isSymbolicLink()) continue;

    const rootPath = path.join(TEMP_ROOT, root.name);
    let children;

    try {
      children = fs.readdirSync(rootPath, {
        withFileTypes: true,
      });
    } catch (error) {
      console.error(
        "Could not inspect Zeka temp directory:",
        rootPath,
        error.message
      );
      continue;
    }

    for (const child of children) {
      if (child.isSymbolicLink()) continue;
      if (!child.isDirectory() && !child.isFile()) continue;

      const targetPath = path.join(rootPath, child.name);
      const details = inspectPath(targetPath);

      if (!details || details.latestMtime > cutoff) continue;

      candidates.push({
        path: targetPath,
        size: details.size,
        latestMtime: details.latestMtime,
      });
    }
  }

  return candidates.sort(
    (a, b) => a.latestMtime - b.latestMtime
  );
}

async function cleanupOldTempFiles() {
  if (cleanupRunning) return;

  cleanupRunning = true;

  try {
    let usage = getDiskUsage();

    console.log(
      "Zeka temp cleanup disk usage:",
      `${usage.usedPercent.toFixed(2)}%`
    );

    if (usage.usedPercent < HIGH_WATERMARK_PERCENT) {
      console.log("Zeka temp cleanup not needed.");
      return;
    }

    const candidates = getCleanupCandidates();

    let removedItems = 0;
    let removedBytes = 0;

    for (const candidate of candidates) {
      if (usage.usedPercent <= LOW_WATERMARK_PERCENT) break;

      try {
        const currentDetails = inspectPath(candidate.path);

        if (!currentDetails) continue;

        const cutoff = Date.now() - STALE_AFTER_MS;

        if (currentDetails.latestMtime > cutoff) continue;

        fs.rmSync(candidate.path, {
          recursive: true,
          force: true,
        });

        removedItems += 1;
        removedBytes += currentDetails.size;

        console.log(
          "Removed old Zeka temp data:",
          candidate.path
        );
      } catch (error) {
        console.error(
          "Could not remove old Zeka temp data:",
          candidate.path,
          error.message
        );
      }

      try {
        usage = getDiskUsage();
      } catch (error) {
        console.error(
          "Could not recheck disk usage; stopping cleanup:",
          error.message
        );
        break;
      }
    }

    console.log(
      "Zeka temp cleanup finished:",
      JSON.stringify({
        removedItems,
        removedBytes,
        finalUsedPercent: Number(usage.usedPercent.toFixed(2)),
      })
    );

    if (usage.usedPercent > LOW_WATERMARK_PERCENT) {
      console.log(
        "Disk usage remains above target. No eligible old files may remain."
      );
    }
  } catch (error) {
    console.error("Zeka temp cleanup failed:", error.message);
  } finally {
    cleanupRunning = false;
  }
}

function startTempFileCleanupService() {
  if (cleanupInterval) return;

  console.log(
    "Zeka temp cleanup service started; checking every 5 minutes."
  );

  void cleanupOldTempFiles();

  cleanupInterval = setInterval(() => {
    void cleanupOldTempFiles();
  }, CHECK_INTERVAL_MS);

  if (typeof cleanupInterval.unref === "function") {
    cleanupInterval.unref();
  }
}

module.exports = {
  cleanupOldTempFiles,
  startTempFileCleanupService,
};
