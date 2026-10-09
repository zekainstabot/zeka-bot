const fs = require("fs");
const path = require("path");
const os = require("os");
const ytdlp = require("yt-dlp-exec");

const DOWNLOAD_ROOT = path.join(
  os.tmpdir(),
  "zeka-tiktok"
);

function createOutputTemplate(jobId) {
  const jobDirectory = path.join(
    DOWNLOAD_ROOT,
    String(jobId)
  );

  fs.mkdirSync(jobDirectory, {
    recursive: true
  });

  return {
    jobDirectory,
    outputTemplate: path.join(
      jobDirectory,
      "%(id)s.%(ext)s"
    )
  };
}

function detectFileContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (
    [".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(extension)
  ) {
    return "PHOTO";
  }

  if (
    [".mp4", ".mov", ".webm", ".mkv"].includes(extension)
  ) {
    return "VIDEO";
  }

  return "UNKNOWN";
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

  const {
    jobDirectory,
    outputTemplate
  } = createOutputTemplate(jobId);

  console.log("TikTok download started:", jobId);

  await ytdlp(normalizedUrl, {
    output: outputTemplate,
    format: "best",
    noPlaylist: true,
    noWarnings: true,
    restrictFilenames: true
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
      ["VIDEO", "PHOTO"].includes(
        detectFileContentType(filePath)
      )
    );

  if (!files.length) {
    throw new Error(
      "TikTok download completed but no supported media file was found"
    );
  }

  files.sort(
    (a, b) =>
      fs.statSync(b).size - fs.statSync(a).size
  );

  const filePath = files[0];
  const contentType = detectFileContentType(filePath);

  console.log("TikTok download completed:", jobId);

  return {
    success: true,
    filePath,
    fileSize: fs.statSync(filePath).size,
    contentType,
    mediaType: contentType,
    sourceUrl: normalizedUrl,
    caption: "",
    finalCost: null
  };
}

module.exports = {
  downloadTikTokMedia
};
