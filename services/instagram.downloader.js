const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");
const ytdlp = require("yt-dlp-exec");

const execFileAsync = promisify(execFile);

const DOWNLOAD_ROOT = path.join(os.tmpdir(), "zeka-instagram");

function createOutputTemplate(jobId) {
  const jobDirectory = path.join(DOWNLOAD_ROOT, String(jobId));

  fs.mkdirSync(jobDirectory, { recursive: true });

  return {
    jobDirectory,
    outputTemplate: path.join(jobDirectory, "%(id)s.%(ext)s"),
  };
}

function cleanInstagramUrl(url) {
  try {
    const parsed = new URL(url);

    parsed.search = "";

    return parsed.toString();
  } catch {
    return url;
  }
}

function normalizeContentType(contentType) {
  if (!contentType) {
    return "OTHER";
  }

  return String(contentType).trim().toUpperCase();
}

function detectInstagramMediaType(metadata, url) {
  if (!metadata) {
    return "UNKNOWN";
  }

  if (Array.isArray(metadata.entries) && metadata.entries.length > 1) {
    return "CAROUSEL";
  }

  if (metadata._type === "playlist") {
    return "CAROUSEL";
  }

  const normalizedUrl = String(url || "").toLowerCase();

  if (
    normalizedUrl.includes("/reel/") ||
    normalizedUrl.includes("/reels/")
  ) {
    return "VIDEO";
  }

  if (
    normalizedUrl.includes("/stories/") ||
    normalizedUrl.includes("/story/")
  ) {
    const ext = String(metadata.ext || "").toLowerCase();

    if (["jpg", "jpeg", "png", "webp", "avif"].includes(ext)) {
      return "PHOTO";
    }

    return "VIDEO";
  }

  const ext = String(metadata.ext || "").toLowerCase();

  if (["jpg", "jpeg", "png", "webp", "avif"].includes(ext)) {
    return "PHOTO";
  }

  if (
    ["mp4", "mov", "webm", "mkv"].includes(ext) ||
    metadata.vcodec
  ) {
    return "VIDEO";
  }

  return "UNKNOWN";
}

function getDownloadFormat(contentType) {
  const normalizedType = normalizeContentType(contentType);

  if (normalizedType === "REEL") {
    return "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best";
  }

  if (normalizedType === "STORY") {
    return "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best";
  }

  if (normalizedType === "PHOTO") {
    return "best[ext=jpg]/best[ext=jpeg]/best[ext=png]/best";
  }

  if (normalizedType === "VIDEO") {
    return "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best";
  }

  return "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best";
}

function detectFileContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if ([".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(ext)) {
    return "PHOTO";
  }

  if ([".mp4", ".mov", ".webm", ".mkv"].includes(ext)) {
    return "VIDEO";
  }

  return "UNKNOWN";
}

async function getInstagramPostHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });

  const html = await response.text();

  return {
    status: response.status,
    finalUrl: response.url,
    html,
  };
}

async function getInstagramMetadata(url) {
  console.log("Instagram metadata extraction started");

  try {
    const metadata = await ytdlp(url, {
      noPlaylist: true,
      noWarnings: true,
      noCheckCertificates: true,
      dumpSingleJson: true,
      skipDownload: true,
    });

    console.log("Instagram metadata extraction completed");

    return metadata;
  } catch (error) {
    console.log(
      "Instagram metadata extraction failed:",
      error?.message || error
    );

    return null;
  }
}

function collectFilesRecursive(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const results = [];

  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      results.push(...collectFilesRecursive(fullPath));
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

function isSupportedMediaFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  return [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".avif",
    ".mp4",
    ".mov",
    ".webm",
    ".mkv",
  ].includes(ext);
}

async function downloadInstagramPhotoWithGalleryDl(url, jobId) {
  console.log("Instagram gallery-dl fallback started:", url);

  const galleryDirectory = path.join(
    DOWNLOAD_ROOT,
    `gallery_${String(jobId)}`
  );

  fs.mkdirSync(galleryDirectory, { recursive: true });

  console.log(
    "Instagram gallery-dl output directory:",
    galleryDirectory
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

    const files = collectFilesRecursive(galleryDirectory).filter(
      isSupportedMediaFile
    );

    if (!files.length) {
      throw new Error("gallery-dl completed but no media file was found");
    }

    console.log("Instagram gallery-dl downloaded files:", files.length);

    return files[0];
  } catch (error) {
    console.log(
      "Instagram gallery-dl failed:",
      error?.stderr || error?.message || error
    );

    throw new Error(
      `gallery-dl failed: ${
        error?.stderr || error?.message || "unknown error"
      }`
    );
  }
}

async function downloadInstagramMedia({
  url,
  jobId,
  contentType = "OTHER",
}) {
  const normalizedUrl = cleanInstagramUrl(url);
  const normalizedContentType = normalizeContentType(contentType);

  console.log("Instagram download started:", jobId);

  const { jobDirectory, outputTemplate } = createOutputTemplate(jobId);

  let metadata = null;

  try {
    metadata = await getInstagramMetadata(normalizedUrl);
  } catch (error) {
    console.log(
      "Instagram metadata extraction error:",
      error?.message || error
    );
  }

  const mediaType = detectInstagramMediaType(
    metadata,
    normalizedUrl
  );

  console.log("Instagram requested content type:", normalizedContentType);
  console.log("Instagram detected media type:", mediaType);

  if (
    normalizedContentType === "POST" &&
    ["PHOTO", "CAROUSEL", "UNKNOWN"].includes(mediaType)
  ) {
    try {
      const galleryFile = await downloadInstagramPhotoWithGalleryDl(
        normalizedUrl,
        jobId
      );

      return {
        filePath: galleryFile,
        contentType: detectFileContentType(galleryFile),
        mediaType,
        finalCost: null,
      };
    } catch (error) {
      console.log(
        "Instagram gallery-dl fallback failed, continuing with yt-dlp"
      );
    }
  }

  const format = getDownloadFormat(normalizedContentType);

  console.log("Instagram selected format:", format);
  console.log("Instagram yt-dlp download started:", normalizedUrl);

  await ytdlp(normalizedUrl, {
    output: outputTemplate,
    format,
    noPlaylist: true,
    noWarnings: true,
    noCheckCertificates: true,
  });

  const files = fs
    .readdirSync(jobDirectory)
    .map((file) => path.join(jobDirectory, file))
    .filter((file) => fs.statSync(file).isFile());

  if (!files.length) {
    throw new Error("Instagram download completed but no file was found");
  }

  const filePath = files[0];

  console.log("Instagram download completed:", filePath);

  return {
    filePath,
    contentType: detectFileContentType(filePath),
    mediaType,
    finalCost: null,
  };
}

module.exports = {
  downloadInstagramMedia,
  getInstagramMetadata,
  getInstagramPostHtml,
  detectInstagramMediaType,
  detectFileContentType,
};
