const fs = require("fs");
const os = require("os");
const path = require("path");
const ytdlp = require("yt-dlp-exec");

const { parseUrl } = require("./url.service");
const { downloadInstagramMedia } = require("./instagram.downloader");
const { downloadTikTokMedia } = require("./tiktok.downloader");

const DOWNLOAD_ROOT = path.join(os.tmpdir(), "zeka-scheduled-media");

const SUPPORTED_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".webm",
  ".mkv",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".mp3",
  ".m4a",
  ".aac",
  ".ogg",
  ".opus",
]);

function detectFileContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if ([".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(extension)) {
    return "PHOTO";
  }

  if ([".mp4", ".mov", ".webm", ".mkv"].includes(extension)) {
    return "VIDEO";
  }

  if ([".mp3", ".m4a", ".aac", ".ogg", ".opus"].includes(extension)) {
    return "AUDIO";
  }

  return "DOCUMENT";
}

function collectMediaFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectMediaFiles(fullPath));
      continue;
    }

    if (
      entry.isFile() &&
      SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) &&
      fs.statSync(fullPath).size > 0
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function readCaption(directory, fallback = "") {
  if (!fs.existsSync(directory)) {
    return String(fallback || "").trim().slice(0, 1024);
  }

  const infoFiles = fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".info.json"));

  for (const name of infoFiles) {
    try {
      const info = JSON.parse(
        fs.readFileSync(path.join(directory, name), "utf8")
      );

      const caption = String(
        info.description || info.title || fallback || ""
      ).trim();

      if (caption) {
        return caption.slice(0, 1024);
      }
    } catch (error) {
      console.error(
        "Scheduled media metadata read failed:",
        error?.message || error
      );
    }
  }

  return String(fallback || "").trim().slice(0, 1024);
}

async function downloadScheduledMedia({ url, jobId }) {
  if (!url || !jobId) {
    throw new Error("لینک و شناسه دانلود الزامی است.");
  }

  const parsed = parseUrl(url);

  if (!parsed.valid || !parsed.platform || !parsed.url) {
    throw new Error(
      "این لینک معتبر نیست یا پلتفرم آن هنوز پشتیبانی نمی‌شود."
    );
  }

  const normalizedUrl = parsed.url;
  const platform = parsed.platform;

  if (platform === "instagram") {
    return downloadInstagramMedia({
      url: normalizedUrl,
      jobId,
      contentType: parsed.contentType || "OTHER",
    });
  }

  if (platform === "tiktok") {
    return downloadTikTokMedia({
      url: normalizedUrl,
      jobId,
    });
  }

  const jobDirectory = path.join(DOWNLOAD_ROOT, String(jobId));

  fs.mkdirSync(jobDirectory, { recursive: true });

  try {
    const outputTemplate = path.join(jobDirectory, "%(id)s.%(ext)s");

    const result = await ytdlp(normalizedUrl, {
      output: outputTemplate,
      format: "best[ext=mp4]/best",
      mergeOutputFormat: "mp4",
      noPlaylist: true,
      noWarnings: true,
      restrictFilenames: true,
      writeInfoJson: true,
      retries: 3,
      extractorRetries: 3,
      fragmentRetries: 3,
      socketTimeout: 30,
    });

    const files = collectMediaFiles(jobDirectory);

    if (!files.length) {
      throw new Error(
        `دانلود ${platform} تمام شد اما فایل قابل‌استفاده‌ای پیدا نشد.`
      );
    }

    files.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);

    const filePath = files[0];
    const contentType = detectFileContentType(filePath);

    return {
      success: true,
      filePath,
      fileSize: fs.statSync(filePath).size,
      contentType,
      mediaType: contentType,
      sourceUrl: normalizedUrl,
      caption: readCaption(jobDirectory, result?.stdout || ""),
      finalCost: null,
    };
  } catch (error) {
    fs.rmSync(jobDirectory, { recursive: true, force: true });
    throw error;
  }
}

module.exports = {
  downloadScheduledMedia,
  detectFileContentType,
};
