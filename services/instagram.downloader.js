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

function cleanInstagramUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  let cleaned = value.trim();

  if (!cleaned) {
    return null;
  }

  const markdownMatch = cleaned.match(
    /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/
  );

  if (markdownMatch) {
    cleaned = markdownMatch[2];
  }

  cleaned = cleaned
    .replace(/^[\"']+|[\"']+$/g, "")
    .trim();

  try {
    const parsed = new URL(cleaned);

    parsed.hash = "";

    return parsed.toString();
  } catch {
    return null;
  }
}

function detectFileContentType(filePath) {
  const extension = path
    .extname(filePath)
    .toLowerCase();

  if (
    [
      ".mp4",
      ".mov",
      ".mkv",
      ".webm",
      ".avi",
      ".m4v",
      ".3gp",
    ].includes(extension)
  ) {
    return "video";
  }

  if (
    [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".gif",
      ".bmp",
      ".avif",
      ".heic",
      ".heif",
    ].includes(extension)
  ) {
    return "photo";
  }

  if (
    [
      ".mp3",
      ".m4a",
      ".aac",
      ".wav",
      ".ogg",
      ".opus",
      ".flac",
    ].includes(extension)
  ) {
    return "audio";
  }

  return "document";
}

async function getInstagramMetadata(url) {
  console.log(
    "Instagram metadata extraction started"
  );

  const metadata = await ytDlp(url, {
    noPlaylist: true,

    noWarnings: true,

    noCheckCertificates: true,

    dumpSingleJson: true,

    skipDownload: true,
  });

  let caption = "";

  if (
    metadata &&
    typeof metadata.description === "string"
  ) {
    caption = metadata.description.trim();
  }

  if (
    !caption &&
    metadata &&
    typeof metadata.title === "string"
  ) {
    caption = metadata.title.trim();
  }

  console.log(
    `Instagram metadata caption length: ${caption.length}`
  );

  return {
    caption,
    metadata,
  };
}

async function downloadInstagramMedia({
  url,
  jobId,
  contentType = "OTHER",
}) {
  if (!url) {
    throw new Error("Instagram URL is required");
  }

  if (!jobId) {
    throw new Error("Job ID is required");
  }

  const cleanUrl = cleanInstagramUrl(url);

  if (!cleanUrl) {
    throw new Error("Invalid Instagram URL");
  }

  ensureDownloadDirectory();

  const outputTemplate =
    createOutputTemplate(jobId);

  let caption = "";

  try {
    const metadata =
      await getInstagramMetadata(cleanUrl);

    caption = metadata.caption || "";
  } catch (metadataError) {
    console.error(
      "Instagram metadata extraction failed:",
      metadataError?.message || metadataError
    );
  }

  console.log(
    `Instagram requested content type: ${contentType}`
  );

  console.log(
    `Instagram yt-dlp download started: ${cleanUrl}`
  );

  await ytDlp(cleanUrl, {
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

  const safeJobId = String(jobId).replace(
    /[^a-zA-Z0-9_-]/g,
    "_"
  );

  const files = fs
    .readdirSync(DOWNLOAD_ROOT)
    .map((name) =>
      path.join(DOWNLOAD_ROOT, name)
    )
    .filter((filePath) => {
      if (!fs.statSync(filePath).isFile()) {
        return false;
      }

      return filePath.startsWith(
        path.join(
          DOWNLOAD_ROOT,
          `${safeJobId}_`
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

  const detectedContentType =
    detectFileContentType(filePath);

  console.log(
    `Instagram detected file type: ${detectedContentType}`
  );

  console.log(
    `Instagram download completed: ${filePath}`
  );

  console.log(
    `Instagram final caption length: ${caption.length}`
  );

  return {
    success: true,
    filePath,
    fileSize: stats.size,
    contentType: detectedContentType,
    sourceUrl: cleanUrl,
    caption,
  };
}

module.exports = {
  downloadInstagramMedia,
  detectFileContentType,
};
