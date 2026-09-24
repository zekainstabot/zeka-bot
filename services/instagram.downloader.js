const fs = require("fs");
const path = require("path");
const os = require("os");
const ytDlp = require("yt-dlp-exec");

const DOWNLOAD_ROOT = path.join(
  os.tmpdir(),
  "zeka-instagram"
);

function ensureDownloadDirectory() {
  fs.mkdirSync(DOWNLOAD_ROOT, {
    recursive: true,
  });

  return DOWNLOAD_ROOT;
}

function createOutputTemplate(jobId) {
  const safeJobId = String(jobId).replace(
    /[^a-zA-Z0-9_-]/g,
    "_"
  );

  return path.join(
    DOWNLOAD_ROOT,
    `${safeJobId}_%(id)s.%(ext)s`
  );
}

async function downloadInstagramMedia({
  url,
  jobId,
}) {
  if (!url) {
    throw new Error("Instagram URL is required");
  }

  if (!jobId) {
    throw new Error("Job ID is required");
  }

  ensureDownloadDirectory();

  const outputTemplate = createOutputTemplate(jobId);

  console.log(
    `Instagram yt-dlp download started: ${url}`
  );

  await ytDlp(url, {
    output: outputTemplate,

    noPlaylist: true,

    restrictFilenames: true,

    noWarnings: true,

    preferFreeFormats: true,

    format:
      "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",

    mergeOutputFormat: "mp4",

    retries: 2,

    socketTimeout: 30,

    noCheckCertificates: true,
  });

  const files = fs
    .readdirSync(DOWNLOAD_ROOT)
    .map((name) => path.join(DOWNLOAD_ROOT, name))
    .filter((filePath) => {
      if (!fs.statSync(filePath).isFile()) {
        return false;
      }

      return filePath.startsWith(
        path.join(
          DOWNLOAD_ROOT,
          `${String(jobId).replace(
            /[^a-zA-Z0-9_-]/g,
            "_"
          )}_`
        )
      );
    });

  if (files.length === 0) {
    throw new Error(
      "Instagram downloader completed but no file was created"
    );
  }

  const filePath = files.sort(
    (a, b) =>
      fs.statSync(b).mtimeMs -
      fs.statSync(a).mtimeMs
  )[0];

  const stats = fs.statSync(filePath);

  if (stats.size <= 0) {
    throw new Error(
      "Instagram downloader created an empty file"
    );
  }

  console.log(
    `Instagram download completed: ${filePath}`
  );

  return {
    success: true,
    filePath,
    fileSize: stats.size,
    contentType: "video",
    sourceUrl: url,
  };
}

module.exports = {
  downloadInstagramMedia,
};
