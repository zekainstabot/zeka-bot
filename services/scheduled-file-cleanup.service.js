
const fs = require("fs");
const os = require("os");
const path = require("path");
const { getClient } = require("../database/client");

const TEMP_ROOT = os.tmpdir();

const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

let cleanupRunning = false;
let cleanupInterval = null;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(2)} ${units[index]}`;
}

function inspectPath(targetPath) {
  let stats;

  try {
    stats = fs.lstatSync(targetPath);
  } catch {
    return null;
  }

  if (stats.isSymbolicLink()) return null;

  if (stats.isFile()) {
    return {
      size: stats.size,
      latestMtime: stats.mtimeMs,
    };
  }

  if (!stats.isDirectory()) return null;

  let entries;

  try {
    entries = fs.readdirSync(targetPath, {
      withFileTypes: true,
    });
  } catch {
    return null;
  }

  let size = 0;
  let latestMtime = stats.mtimeMs;

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;

    const result = inspectPath(
      path.join(targetPath, entry.name)
    );

    if (!result) continue;

    size += result.size;
    latestMtime = Math.max(latestMtime, result.latestMtime);
  }

  return { size, latestMtime };
}

function getZekaTempItems() {
  const roots = fs.readdirSync(TEMP_ROOT, {
    withFileTypes: true,
  });

  const items = [];

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
        "Zeka temp directory inspection failed:",
        rootPath,
        error.message
      );
      continue;
    }

    let rootSize = 0;

    for (const child of children) {
      if (child.isSymbolicLink()) continue;
      if (!child.isDirectory() && !child.isFile()) continue;

      const childPath = path.join(rootPath, child.name);
      const details = inspectPath(childPath);

      if (!details) continue;

      rootSize += details.size;

      items.push({
        path: childPath,
        size: details.size,
        latestMtime: details.latestMtime,
      });
    }

    console.log(
      "Zeka temp directory usage:",
      JSON.stringify({
        directory: rootPath,
        size: formatBytes(rootSize),
        items: children.length,
      })
    );
  }

  return items;
}

async function getProtectedFilePaths() {
  const db = getClient();

  const result = await db.query(`
    SELECT file_path
    FROM zeka_media_queue
    WHERE status IN ('PENDING', 'PUBLISHING')
  `);

  return result.rows
    .map((row) => row.file_path)
    .filter((filePath) => typeof filePath === "string" && filePath.length > 0)
    .map((filePath) => path.resolve(filePath));
}

function containsProtectedFile(directoryPath, protectedPaths) {
  const resolvedDirectory = path.resolve(directoryPath);

  return protectedPaths.some((protectedPath) => {
    const relative = path.relative(resolvedDirectory, protectedPath);

    return (
      relative === "" ||
      (
        relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative)
      )
    );
  });
}

async function cleanupOldTempFiles() {
  if (cleanupRunning) return;

  cleanupRunning = true;

  try {
    let protectedPaths;

    try {
      protectedPaths = await getProtectedFilePaths();
    } catch (error) {
      console.error(
        "Zeka temp cleanup skipped: could not read review queue.",
        error.message
      );

      // Fail safely: if the database cannot be checked,
      // do not risk deleting files awaiting review.
      return;
    }

    const items = getZekaTempItems();
    const cutoff = Date.now() - STALE_AFTER_MS;

    let totalBefore = 0;
    let removedItems = 0;
    let removedBytes = 0;
    let protectedItems = 0;

    for (const item of items) {
      totalBefore += item.size;
    }

    console.log(
      "Zeka temp storage before cleanup:",
      formatBytes(totalBefore)
    );

    for (const item of items) {
      if (item.latestMtime > cutoff) continue;

      if (containsProtectedFile(item.path, protectedPaths)) {
        protectedItems += 1;

        console.log(
          "Preserved Zeka media awaiting review:",
          item.path
        );

        continue;
      }

      try {
        const current = inspectPath(item.path);

        if (!current || current.latestMtime > cutoff) continue;

        // Recheck the database-backed protected paths immediately
        // before deletion using the latest snapshot from this run.
        if (containsProtectedFile(item.path, protectedPaths)) continue;

        fs.rmSync(item.path, {
          recursive: true,
          force: true,
        });

        removedItems += 1;
        removedBytes += current.size;

        console.log(
          "Removed stale Zeka temp item:",
          JSON.stringify({
            path: item.path,
            size: formatBytes(current.size),
          })
        );
      } catch (error) {
        console.error(
          "Zeka temp cleanup failed for item:",
          item.path,
          error.message
        );
      }
    }

    const remaining = getZekaTempItems();
    const totalAfter = remaining.reduce(
      (sum, item) => sum + item.size,
      0
    );

    console.log(
      "Zeka temp cleanup finished:",
      JSON.stringify({
        removedItems,
        protectedItems,
        removedBytes: formatBytes(removedBytes),
        remainingZekaTempBytes: formatBytes(totalAfter),
      })
    );
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
