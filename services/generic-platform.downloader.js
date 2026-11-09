const fs = require("fs");
const path = require("path");
const os = require("os");
const ytdlp = require("yt-dlp-exec");

const ROOT = path.join(os.tmpdir(), "zeka-platforms");

const HOSTS = {
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.watch"],
  x: ["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"],
  pinterest: ["pinterest.com", "www.pinterest.com", "pin.it"],
  reddit: ["reddit.com", "www.reddit.com", "old.reddit.com", "redd.it", "www.redd.it"],
  soundcloud: ["soundcloud.com", "www.soundcloud.com", "m.soundcloud.com", "on.soundcloud.com"],
  twitch: ["twitch.tv", "www.twitch.tv", "clips.twitch.tv"],
  vimeo: ["vimeo.com", "www.vimeo.com", "player.vimeo.com"],
  dailymotion: ["dailymotion.com", "www.dailymotion.com", "dai.ly"],
  snapchat: ["snapchat.com", "www.snapchat.com", "story.snapchat.com"],
  threads: ["threads.net", "www.threads.net"],
};

function detectContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(ext)) return "PHOTO";
  if ([".mp3", ".m4a", ".aac", ".opus", ".wav", ".flac"].includes(ext)) return "AUDIO";
  if ([".mp4", ".mov", ".webm", ".mkv", ".m4v"].includes(ext)) return "VIDEO";
  return "UNKNOWN";
}

function cleanText(value) {
  if (typeof value !== "string") return "";
  const text = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  return !text || ["NA", "null", "None"].includes(text) ? "" : text.slice(0, 1024);
}

function readCaption(directory) {
  const infoFiles = fs.readdirSync(directory).filter((name) => name.endsWith(".info.json"));
  for (const name of infoFiles) {
    try {
      const info = JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
      const caption = cleanText(info.description) || cleanText(info.title) || cleanText(info.fulltitle);
      if (caption) return caption;
    } catch (error) {
      console.warn("Platform metadata read failed:", error.message);
    }
  }
  return "";
}

async function downloadPlatformMedia({ platform, url, jobId }) {
  if (!platform || !url || !jobId) throw new Error("Platform, URL and job ID are required");
  const allowedHosts = HOSTS[platform];
  if (!allowedHosts) throw new Error(`Unsupported platform: ${platform}`);

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid media URL");
  }

  if (parsed.protocol !== "https:" || !allowedHosts.includes(parsed.hostname.toLowerCase())) {
    throw new Error(`Unsupported ${platform} URL`);
  }

  const directory = path.join(ROOT, platform, String(jobId));
  fs.mkdirSync(directory, { recursive: true });
  const output = path.join(directory, "%(id)s.%(ext)s");

  await ytdlp(parsed.toString(), {
    output,
    format: platform === "soundcloud" ? "bestaudio/best" : "best[ext=mp4]/best",
    mergeOutputFormat: "mp4",
    noPlaylist: true,
    noWarnings: true,
    restrictFilenames: true,
    writeInfoJson: true,
    socketTimeout: 30,
    retries: 2,
    fragmentRetries: 2,
  });

  const files = fs.readdirSync(directory)
    .map((name) => path.join(directory, name))
    .filter((file) => {
      try {
        return fs.statSync(file).isFile() && ["VIDEO", "PHOTO", "AUDIO"].includes(detectContentType(file));
      } catch {
        return false;
      }
    })
    .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);

  if (!files.length) throw new Error(`${platform} download produced no supported media file`);

  const filePath = files[0];
  return {
    success: true,
    filePath,
    fileSize: fs.statSync(filePath).size,
    contentType: detectContentType(filePath),
    sourceUrl: parsed.toString(),
    caption: readCaption(directory),
  };
}

module.exports = { downloadPlatformMedia };
