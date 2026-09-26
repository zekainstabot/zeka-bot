const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");
const ytDlp = require("yt-dlp-exec");

const execFileAsync = promisify(execFile);

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

function createGalleryDownloadDirectory(jobId) {
  const safeJobId = String(jobId).replace(
    /[^a-zA-Z0-9_-]/g,
    "_"
  );

  const directory = path.join(
    DOWNLOAD_ROOT,
    `gallery_${safeJobId}`
  );

  fs.mkdirSync(directory, {
    recursive: true,
  });

  return directory;
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

function normalizeContentType(contentType) {
  if (!contentType) {
    return "OTHER";
  }

  return String(contentType)
    .trim()
    .toUpperCase();
}

function detectInstagramMediaType(metadata) {
  if (!metadata) {
    return "UNKNOWN";
  }

  if (
    Array.isArray(metadata.entries) &&
    metadata.entries.length > 1
  ) {
    return "CAROUSEL";
  }

  const extractorType = String(
    metadata._type || ""
  ).toLowerCase();

  if (extractorType === "playlist") {
    return "CAROUSEL";
  }

  const webpageUrl = String(
    metadata.webpage_url ||
      metadata.original_url ||
      ""
  ).toLowerCase();

  if (
    webpageUrl.includes("/reel/") ||
    webpageUrl.includes("/reels/")
  ) {
    return "VIDEO";
  }

  if (
    webpageUrl.includes("/stories/") ||
    webpageUrl.includes("/story/")
  ) {
    if (
      metadata.ext &&
      [
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "avif",
      ].includes(
        String(metadata.ext).toLowerCase()
      )
    ) {
      return "PHOTO";
    }

    return "VIDEO";
  }

  const ext = String(
    metadata.ext || ""
  ).toLowerCase();

  if (
    [
      "jpg",
      "jpeg",
      "png",
      "webp",
      "gif",
      "avif",
      "heic",
      "heif",
    ].includes(ext)
  ) {
    return "PHOTO";
  }

  if (
    [
      "mp4",
      "mov",
      "webm",
      "mkv",
      "m4v",
      "avi",
      "3gp",
    ].includes(ext)
  ) {
    return "VIDEO";
  }

  if (
    metadata.vcodec &&
    metadata.vcodec !== "none"
  ) {
    return "VIDEO";
  }

  return "UNKNOWN";
}

function getDownloadFormat(
  contentType,
  mediaType = "UNKNOWN"
) {
  const normalizedType =
    normalizeContentType(contentType);

  if (
    normalizedType === "REEL" ||
    normalizedType === "STORY"
  ) {
    return {
      format:
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      mergeOutputFormat: "mp4",
    };
  }

  if (mediaType === "PHOTO") {
    return {
      format:
        "best[ext=jpg]/best[ext=jpeg]/best[ext=png]/best[ext=webp]/best",
      mergeOutputFormat: null,
    };
  }

  if (mediaType === "VIDEO") {
    return {
      format:
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      mergeOutputFormat: "mp4",
    };
  }

  if (
    normalizedType === "POST" ||
    normalizedType === "PROFILE"
  ) {
    return {
      format:
        "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best",
      mergeOutputFormat: "mp4",
    };
  }

  return {
    format:
      "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best",
    mergeOutputFormat: "mp4",
  };
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

  const mediaType =
    detectInstagramMediaType(metadata);

  console.log(
    `Instagram metadata media type: ${mediaType}`
  );

  console.log(
    `Instagram metadata entries: ${
      Array.isArray(metadata?.entries)
        ? metadata.entries.length
        : 0
    }`
  );

  console.log(
    `Instagram metadata caption length: ${caption.length}`
  );

  return {
    caption,
    metadata,
    mediaType,
  };
}

function collectFilesRecursive(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs.readdirSync(
    directory,
    {
      withFileTypes: true,
    }
  );

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(
      directory,
      entry.name
    );

    if (entry.isDirectory()) {
      files.push(
        ...collectFilesRecursive(fullPath)
      );
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function isSupportedMediaFile(filePath) {
  const extension = path
    .extname(filePath)
    .toLowerCase();

  return [
    ".mp4",
    ".mov",
    ".mkv",
    ".webm",
    ".avi",
    ".m4v",
    ".3gp",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".bmp",
    ".avif",
    ".heic",
    ".heif",
    ".mp3",
    ".m4a",
    ".aac",
    ".wav",
    ".ogg",
    ".opus",
    ".flac",
  ].includes(extension);
}

async function downloadInstagramPhotoWithGalleryDl({
  url,
  jobId,
}) {
  const galleryDirectory =
    createGalleryDownloadDirectory(jobId);

  console.log(
    `Instagram gallery-dl fallback started: ${url}`
  );

  console.log(
    `Instagram gallery-dl output directory: ${galleryDirectory}`
  );

  try {
    await execFileAsync(
      "python3",
      [
        "-m",
        "gallery_dl",
        "-D",
        galleryDirectory,
        "--no-mtime",
        url,
      ],
      {
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
  } catch (error) {
    const stdout =
      error?.stdout || "";

    const stderr =
      error?.stderr || "";

    console.error(
      "Instagram gallery-dl failed:"
    );

    if (stdout) {
      console.error(stdout);
    }

    if (stderr) {
      console.error(stderr);
    }

    throw new Error(
      `gallery-dl failed: ${
        stderr ||
        error?.message ||
        "unknown error"
      }`
    );
  }

  const files =
    collectFilesRecursive(
      galleryDirectory
    )
      .filter(isSupportedMediaFile)
      .filter((filePath) => {
        try {
          return (
            fs.statSync(filePath).size > 0
          );
        } catch {
          return false;
        }
      });

  if (files.length === 0) {
    throw new Error(
      "gallery-dl completed but no media file was created"
    );
  }

  const sortedFiles =
    files.sort(
      (a, b) =>
        fs.statSync(b).mtimeMs -
        fs.statSync(a).mtimeMs
    );

  const filePath =
    sortedFiles[0];

  const stats =
    fs.statSync(filePath);

  const detectedContentType =
    detectFileContentType(filePath);

  console.log(
    `Instagram gallery-dl detected file type: ${detectedContentType}`
  );

  console.log(
    `Instagram gallery-dl downloaded file: ${filePath}`
  );

  console.log(
    `Instagram gallery-dl file size: ${stats.size}`
  );

  return {
    filePath,
    fileSize: stats.size,
    contentType:
      detectedContentType,
    mediaType:
      detectedContentType === "photo"
        ? "PHOTO"
        : detectedContentType === "video"
        ? "VIDEO"
        : "UNKNOWN",
  };
}

async function downloadInstagramMedia({
  url,
  jobId,
  contentType = "OTHER",
}) {
  if (!url) {
    throw new Error(
      "Instagram URL is required"
    );
  }

  if (!jobId) {
    throw new Error(
      "Job ID is required"
    );
  }

  const cleanUrl =
    cleanInstagramUrl(url);

  if (!cleanUrl) {
    throw new Error(
      "Invalid Instagram URL"
    );
  }

  ensureDownloadDirectory();

  const outputTemplate =
    createOutputTemplate(jobId);

  let caption = "";
  let mediaType = "UNKNOWN";
  let metadataFailed = false;

  try {
    const metadata =
      await getInstagramMetadata(
        cleanUrl
      );

    caption =
      metadata.caption || "";

    mediaType =
      metadata.mediaType || "UNKNOWN";
  } catch (metadataError) {
    metadataFailed = true;

    console.error(
      "Instagram metadata extraction failed:",
      metadataError?.message ||
        metadataError
    );
  }

  const normalizedContentType =
    normalizeContentType(
      contentType
    );

  console.log(
    `Instagram requested content type: ${contentType}`
  );

  console.log(
    `Instagram detected media type: ${mediaType}`
  );

  if (
    normalizedContentType === "POST" &&
    (mediaType === "PHOTO" ||
      mediaType === "CAROUSEL" ||
      mediaType === "UNKNOWN" ||
      metadataFailed)
  ) {
    try {
      const galleryResult =
        await downloadInstagramPhotoWithGalleryDl({
          url: cleanUrl,
          jobId,
        });

      console.log(
        "Instagram POST downloaded using gallery-dl"
      );

      return {
        success: true,
        filePath:
          galleryResult.filePath,
        fileSize:
          galleryResult.fileSize,
        contentType:
          galleryResult.contentType,
        sourceUrl: cleanUrl,
        caption,
        mediaType:
          galleryResult.mediaType,
      };
    } catch (galleryError) {
      console.error(
        "Instagram gallery-dl fallback failed:",
        galleryError?.message ||
          galleryError
      );

      if (
        mediaType === "PHOTO" ||
        mediaType === "CAROUSEL"
      ) {
        throw galleryError;
      }

      console.log(
        "Instagram gallery-dl fallback failed, continuing with yt-dlp"
      );
    }
  }

  const downloadFormat =
    getDownloadFormat(
      contentType,
      mediaType
    );

  console.log(
    `Instagram selected format: ${downloadFormat.format}`
  );

  console.log(
    `Instagram yt-dlp download started: ${cleanUrl}`
  );

  const ytDlpOptions = {
    output: outputTemplate,

    noPlaylist: true,

    restrictFilenames: true,

    noWarnings: true,

    preferFreeFormats: true,

    format: downloadFormat.format,

    retries: 2,

    socketTimeout: 30,

    noCheckCertificates: true,
  };

  if (downloadFormat.mergeOutputFormat) {
    ytDlpOptions.mergeOutputFormat =
      downloadFormat.mergeOutputFormat;
  }

  await ytDlp(
    cleanUrl,
    ytDlpOptions
  );

  const safeJobId =
    String(jobId).replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    );

  const files = fs
    .readdirSync(DOWNLOAD_ROOT)
    .map((name) =>
      path.join(
        DOWNLOAD_ROOT,
        name
      )
    )
    .filter((filePath) => {
      if (
        !fs.statSync(filePath).isFile()
      ) {
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

  const filePath =
    files.sort(
      (a, b) =>
        fs.statSync(b).mtimeMs -
        fs.statSync(a).mtimeMs
    )[0];

  const stats =
    fs.statSync(filePath);

  if (stats.size <= 0) {
    throw new Error(
      "Instagram downloader created an empty file"
    );
  }

  const detectedContentType =
    detectFileContentType(
      filePath
    );

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
    contentType:
      detectedContentType,
    sourceUrl: cleanUrl,
    caption,
    mediaType,
  };
}

module.exports = {
  downloadInstagramMedia,
  detectFileContentType,
  detectInstagramMediaType,
  getDownloadFormat,
};
