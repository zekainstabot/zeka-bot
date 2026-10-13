const fs = require("fs");
const os = require("os");
const path = require("path");

const TEMP_ROOT = os.tmpdir();
const HOME_ROOT = os.homedir();
const PROJECT_ROOT = process.cwd();

const HIGH_WATERMARK_PERCENT = 50;
const LOW_WATERMARK_PERCENT = 45;
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const DIAGNOSTIC_MAX_DEPTH = 7;
const DIAGNOSTIC_MAX_ENTRIES = 20000;

let cleanupRunning = false;
let cleanupInterval = null;
let diagnosticsLogged = false;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "unknown";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

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
    const child = inspectPath(path.join(targetPath, name));

    if (!child) continue;

    size += child.size;
    latestMtime = Math.max(latestMtime, child.latestMtime);
  }

  return { size, latestMtime };
}

function inspectPathLimited(targetPath, state, depth = 0) {
  if (state.entries >= DIAGNOSTIC_MAX_ENTRIES) {
    return { size: 0, complete: false };
  }

  let stats;

  try {
    stats = fs.lstatSync(targetPath);
  } catch {
    return { size: 0, complete: true };
  }

  if (stats.isSymbolicLink()) {
    return { size: 0, complete: true };
  }

  if (stats.isFile()) {
    state.entries += 1;

    return {
      size: stats.size,
      complete: true,
    };
  }

  if (!stats.isDirectory()) {
    return { size: 0, complete: true };
  }

  if (depth >= DIAGNOSTIC_MAX_DEPTH) {
    return {
      size: 0,
      complete: false,
    };
  }

  let entries;

  try {
    entries = fs.readdirSync(targetPath, {
      withFileTypes: true,
    });
  } catch {
    return { size: 0, complete: false };
  }

  let size = 0;
  let complete = true;

  for (const entry of entries) {
    if (state.entries >= DIAGNOSTIC_MAX_ENTRIES) {
      complete = false;
      break;
    }

    if (entry.isSymbolicLink()) continue;
    if (!entry.isDirectory() && !entry.isFile()) continue;

    const result = inspectPathLimited(
      path.join(targetPath, entry.name),
      state,
      depth + 1
    );

    size += result.size;

    if (!result.complete) {
      complete = false;
    }
  }

  return { size, complete };
}

function logDirectoryInventory(directoryPath, label) {
  let entries;

  try {
    entries = fs.readdirSync(directoryPath, {
      withFileTypes: true,
    });
  } catch (error) {
    console.log(
      "Zeka disk diagnostic: directory unavailable",
      JSON.stringify({
        label,
        path: directoryPath,
        error: error.message,
      })
    );
    return;
  }

  const results = [];
  const state = { entries: 0 };

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    if (!entry.isDirectory() && !entry.isFile()) continue;

    const targetPath = path.join(directoryPath, entry.name);

    const result = inspectPathLimited(targetPath, state);

    results.push({
      name: entry.name,
      path: targetPath,
      size: result.size,
      complete: result.complete,
    });
  }

  results.sort((a, b) => b.size - a.size);

  console.log(
    `Zeka disk diagnostic: ${label}`,
    JSON.stringify({
      path: directoryPath,
      scannedEntries: state.entries,
      scanLimit: DIAGNOSTIC_MAX_ENTRIES,
      largestItems: results.slice(0, 15).map((item) => ({
        name: item.name,
        path: item.path,
        size: formatBytes(item.size),
        scanComplete: item.complete,
      })),
    })
  );
}

function logStorageDiagnostics() {
  if (diagnosticsLogged) return;

  diagnosticsLogged = true;

  console.log("Zeka disk diagnostic started.");

  try {
    const usage = getDiskUsage();

    console.log(
      "Zeka disk diagnostic: filesystem",
      JSON.stringify({
        tempRoot: TEMP_ROOT,
        total: formatBytes(usage.totalBytes),
        used: formatBytes(usage.usedBytes),
        available: formatBytes(usage.availableBytes),
        usedPercent: Number(usage.usedPercent.toFixed(2)),
      })
    );
  } catch (error) {
    console.error(
      "Zeka disk diagnostic: filesystem check failed:",
      error.message
    );
  }

  logDirectoryInventory(TEMP_ROOT, "temporary directory");

  logDirectoryInventory(
    PROJECT_ROOT,
    "project root"
  );

  logDirectoryInventory(
    path.join(HOME_ROOT, ".cache"),
    "home cache"
  );

  logDirectoryInventory(
    path.join(HOME_ROOT, ".cache", "yt-dlp"),
    "yt-dlp cache"
  );

  logDirectoryInventory(
    path.join(HOME_ROOT, ".cache", "gallery-dl"),
    "gallery-dl cache"
  );

  console.log("Zeka disk diagnostic finished.");
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
        removedBytes: formatBytes(removedBytes),
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

  logStorageDiagnostics();

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
