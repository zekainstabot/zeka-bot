const fs = require("fs");
const path = require("path");
const os = require("os");
const ytdlp = require("yt-dlp-exec");
const ffmpegPath = require("ffmpeg-static");

const DOWNLOAD_ROOT = path.join(os.tmpdir(), "zeka-youtube");
const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
]);

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(extension)) return "PHOTO";
  if ([".mp3", ".m4a", ".aac", ".opus", ".ogg", ".wav", ".flac"].includes(extension)) return "AUDIO";
  if ([".mp4", ".mov", ".webm", ".mkv"].includes(extension)) return "VIDEO";
  return "UNKNOWN";
}

function cleanText(value) {
  if (typeof value !== "string") return "";
  const result = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  return !result || ["NA", "null", "None"].includes(result) ? "" : result.slice(0, 1024);
}

function readCaption(directory) {
  const infoFiles = fs.readdirSync(directory).filter((name) => name.endsWith(".info.json"));
  for (const name of infoFiles) {
    try {
      const info = JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
      const caption = cleanText(info.description) || cleanText(info.title) || cleanText(info.fulltitle);
      if (caption) return caption;
    } catch (error) {
      console.warn("YouTube metadata read failed:", error.message);
    }
  }
  return "";
}

function buildYtDlpOptions(output, audioOnly = false) {
  return {
    verbose: true,
    output,
    format: audioOnly ? "bestaudio/best" : "best[ext=mp4]/best",
    ...(audioOnly ? {
      extractAudio: true,
      audioFormat: "mp3",
      audioQuality: "0",
      ffmpegLocation: ffmpegPath,
    } : { mergeOutputFormat: "mp4" }),
    noPlaylist: true,
    restrictFilenames: true,
    writeInfoJson: true,
    socketTimeout: 30,
    retries: 2,
    fragmentRetries: 2,
    impersonate: "chrome",
    extractorArgs: "youtube:player_client=web,mweb,tv,ios,android",
  };
}

async function downloadYouTubeMedia({ url, jobId, audioOnly = false }) {
  if (!url || !jobId) throw new Error("YouTube URL and job ID are required");

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid YouTube URL");
  }

  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error("Unsupported YouTube URL");
  }

  const safeJobId = String(jobId).replace(/[^a-zA-Z0-9_-]/g, "_");
  const directory = path.join(DOWNLOAD_ROOT, safeJobId);
  fs.mkdirSync(directory, { recursive: true });
  const output = path.join(directory, "%(id)s.%(ext)s");

  try {
    await ytdlp(parsed.toString(), buildYtDlpOptions(output, audioOnly), {
      timeout: 15 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    const details = [error.stderr, error.stdout, error.message].filter(Boolean).join("\n");
    console.error("YouTube yt-dlp execution failed:", {
      message: error.message,
      code: error.code,
      signal: error.signal,
      stderr: String(error.stderr || "").slice(-5000),
      stdout: String(error.stdout || "").slice(-5000),
    });
    throw new Error(details.slice(-5000) || "YouTube download failed");
  }

  const files = fs.readdirSync(directory)
    .map((name) => path.join(directory, name))
    .filter((file) => {
      try {
        return fs.statSync(file).isFile() && ["VIDEO", "PHOTO", "AUDIO"].includes(getContentType(file));
      } catch {
        return false;
      }
    })
    .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);

  if (!files.length) {
    throw new Error("YouTube download finished without a supported media file");
  }

  const filePath = files[0];
  return {
    success: true,
    filePath,
    fileSize: fs.statSync(filePath).size,
    contentType: audioOnly ? "AUDIO" : getContentType(filePath),
    sourceUrl: parsed.toString(),
    caption: readCaption(directory),
    finalCost: null,
  };
}

module.exports = {
  downloadYouTubeMedia,
  buildYtDlpOptions,
};
