const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const ytdlp = require("yt-dlp-exec");

const DOWNLOAD_ROOT = path.join(os.tmpdir(), "zeka-tiktok");

function createOutputTemplate(jobId) {
  const jobDirectory = path.join(DOWNLOAD_ROOT, String(jobId));
  fs.mkdirSync(jobDirectory, { recursive: true });

  return {
    jobDirectory,
    outputTemplate: path.join(jobDirectory, "%(id)s.%(ext)s")
  };
}

function detectFileContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if ([".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(extension)) {
    return "PHOTO";
  }

  if ([".mp4", ".mov", ".webm", ".mkv"].includes(extension)) {
    return "VIDEO";
  }

  return "UNKNOWN";
}

function cleanCaption(value) {
  if (typeof value !== "string") return "";

  const caption = value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!caption || ["NA", "null", "None"].includes(caption)) {
    return "";
  }

  return caption.slice(0, 1024);
}

function readCaption(jobDirectory) {
  const infoFiles = fs.readdirSync(jobDirectory)
    .filter((name) => name.endsWith(".info.json"));

  let fallbackCaption = "";

  for (const infoFile of infoFiles) {
    try {
      const infoPath = path.join(jobDirectory, infoFile);
      const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));

      const description = cleanCaption(info.description);
      if (description) return description;

      for (const value of [info.title, info.fulltitle, info.alt_title]) {
        const candidate = cleanCaption(value);
        if (candidate && !fallbackCaption) {
          fallbackCaption = candidate;
        }
      }
    } catch (error) {
      console.error("TikTok metadata read failed:", error.message);
    }
  }

  return fallbackCaption;
}

async function optimizeMp4ForStreaming(filePath) {
  if (path.extname(filePath).toLowerCase() !== ".mp4") {
    return filePath;
  }

  const optimizedPath = path.join(
    path.dirname(filePath),
    `${path.basename(filePath, path.extname(filePath))}.streamable.mp4`
  );

  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", filePath,
      "-map", "0",
      "-c", "copy",
      "-movflags", "+faststart",
      optimizedPath
    ], {
      timeout: 120000,
      maxBuffer: 5 * 1024 * 1024
    });

    if (!fs.existsSync(optimizedPath) || fs.statSync(optimizedPath).size <= 0) {
      throw new Error("Optimized MP4 file was not created");
    }

    return optimizedPath;
  } catch (error) {
    try {
      if (fs.existsSync(optimizedPath)) fs.unlinkSync(optimizedPath);
    } catch {}

    console.warn("TikTok faststart optimization unavailable:", error.message);
    return filePath;
  }
}

async function downloadTikTokMedia({ url, jobId }) {
  if (!url || !jobId) {
    throw new Error("TikTok URL and job ID are required");
  }

  let normalizedUrl;

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    const allowedHosts = [
      "tiktok.com",
      "www.tiktok.com",
      "m.tiktok.com",
      "vm.tiktok.com",
      "vt.tiktok.com"
    ];

    if (!allowedHosts.includes(hostname)) {
      throw new Error("Unsupported TikTok URL");
    }

    if (parsedUrl.protocol !== "https:") {
      throw new Error("TikTok URL must use HTTPS");
    }

    normalizedUrl = parsedUrl.toString();
  } catch (error) {
    throw new Error(`Invalid TikTok URL: ${error.message}`);
  }

  const { jobDirectory, outputTemplate } = createOutputTemplate(jobId);

  console.log("TikTok download started:", jobId);

  await ytdlp(normalizedUrl, {
    output: outputTemplate,
    format: "best[ext=mp4]/best",
    mergeOutputFormat: "mp4",
    remuxVideo: "mp4",
    noPlaylist: true,
    noWarnings: true,
    restrictFilenames: true,
    writeInfoJson: true
  });

  const files = fs.readdirSync(jobDirectory)
    .map((name) => path.join(jobDirectory, name))
    .filter((filePath) => {
      try {
        return fs.statSync(filePath).isFile();
      } catch {
        return false;
      }
    })
    .filter((filePath) =>
      ["VIDEO", "PHOTO"].includes(detectFileContentType(filePath))
    );

  if (!files.length) {
    throw new Error("TikTok download completed but no supported media file was found");
  }

  files.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);

  let filePath = files[0];

  if (detectFileContentType(filePath) === "VIDEO") {
    filePath = await optimizeMp4ForStreaming(filePath);
  }

  const contentType = detectFileContentType(filePath);
  const caption = readCaption(jobDirectory);

  console.log(
    "TikTok download completed:",
    jobId,
    "Content type:",
    contentType,
    "Caption found:",
    Boolean(caption),
    "Caption length:",
    caption.length
  );

  return {
    success: true,
    filePath,
    fileSize: fs.statSync(filePath).size,
    contentType,
    mediaType: contentType,
    sourceUrl: normalizedUrl,
    caption,
    finalCost: null
  };
}

module.exports = {
  downloadTikTokMedia
};
