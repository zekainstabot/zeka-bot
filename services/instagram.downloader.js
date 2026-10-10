
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const ytdlp = require("yt-dlp-exec");

const {
  getInstagramCookie,
} = require("./instagram-cookie.service");

const {
  downloadInstagramWithBrowser,
  downloadInstagramProfile,
} = require("./instagram.browser");

const DOWNLOAD_ROOT = path.join(
  os.tmpdir(),
  "zeka-instagram"
);

const INSTAGRAM_GRAPHQL_URL =
  "https://www.instagram.com/graphql/query";

const INSTAGRAM_POST_DOC_ID =
  "27128499623469141";

const SUPPORTED_MEDIA_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".webm",
  ".mkv",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
];

function createOutputTemplate(jobId) {
  const jobDirectory = path.join(
    DOWNLOAD_ROOT,
    String(jobId)
  );

  fs.mkdirSync(jobDirectory, {
    recursive: true,
  });

  return {
    jobDirectory,
    outputTemplate: path.join(
      jobDirectory,
      "%(id)s.%(ext)s"
    ),
  };
}

async function createInstagramCookieFile(jobDirectory) {
  const cookieText = await getInstagramCookie();

  if (!cookieText || !String(cookieText).trim()) {
    console.log("Instagram cookie is not configured.");
    return null;
  }

  const cookiePath = path.join(
    jobDirectory,
    ".instagram-cookies.txt"
  );

  fs.writeFileSync(cookiePath, cookieText, {
    encoding: "utf8",
    mode: 0o600,
  });

  console.log(
    "Instagram cookie file prepared for final fallback."
  );

  return cookiePath;
}

function collectMediaFiles(directory) {
  const found = [];

  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      found.push(...collectMediaFiles(fullPath));
      continue;
    }

    if (
      entry.isFile() &&
      SUPPORTED_MEDIA_EXTENSIONS.includes(
        path.extname(entry.name).toLowerCase()
      )
    ) {
      found.push(fullPath);
    }
  }

  return found;
}

function sortMediaFiles(files) {
  return files.sort((a, b) => {
    const aIsVideo = detectFileContentType(a) === "VIDEO";
    const bIsVideo = detectFileContentType(b) === "VIDEO";

    if (aIsVideo !== bIsVideo) {
      return aIsVideo ? -1 : 1;
    }

    return fs.statSync(b).size - fs.statSync(a).size;
  });
}

function getNonEmptyMediaFiles(jobDirectory) {
  return collectMediaFiles(jobDirectory).filter((file) => {
    try {
      return fs.statSync(file).size > 0;
    } catch {
      return false;
    }
  });
}

function makeSuccessResult({
  filePath,
  mediaType,
  sourceUrl,
  caption = "",
}) {
  return {
    success: true,
    filePath,
    fileSize: fs.statSync(filePath).size,
    contentType: detectFileContentType(filePath),
    mediaType,
    sourceUrl,
    caption,
    finalCost: null,
  };
}

async function downloadStoryWithGalleryDl({
  url,
  jobDirectory,
}) {
  console.log(
    "Instagram Story gallery-dl fallback started without cookies."
  );

  await execFileAsync(
    "gallery-dl",
    [
      "-D",
      jobDirectory,
      "--no-mtime",
      url,
    ],
    {
      timeout: 90000,
      maxBuffer: 5 * 1024 * 1024,
    }
  );

  const files = sortMediaFiles(
    getNonEmptyMediaFiles(jobDirectory)
  );

  if (!files.length) {
    throw new Error(
      "gallery-dl finished but no supported Story media was found."
    );
  }

  console.log(
    "Instagram Story gallery-dl completed:",
    files[0]
  );

  return makeSuccessResult({
    filePath: files[0],
    mediaType: "STORY",
    sourceUrl: url,
  });
}

function cleanInstagramUrl(url) {
  try {
    const parsed = new URL(url);

    parsed.search = "";
    parsed.hash = "";

    return parsed.toString();
  } catch {
    return url;
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

function getDownloadFormat(contentType) {
  const normalizedType =
    normalizeContentType(contentType);

  if (
    normalizedType === "REEL" ||
    normalizedType === "STORY" ||
    normalizedType === "VIDEO"
  ) {
    return (
      "best[ext=mp4]/" +
      "bestvideo[ext=mp4]+" +
      "bestaudio[ext=m4a]/best"
    );
  }

  return (
    "best[ext=mp4]/" +
    "bestvideo[ext=mp4]+" +
    "bestaudio[ext=m4a]/best"
  );
}

function detectFileContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (
    [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".avif",
    ].includes(ext)
  ) {
    return "PHOTO";
  }

  if (
    [
      ".mp4",
      ".mov",
      ".webm",
      ".mkv",
    ].includes(ext)
  ) {
    return "VIDEO";
  }

  return "UNKNOWN";
}

function extractInstagramShortcode(url) {
  try {
    const parsed = new URL(url);

    const parts = parsed.pathname
      .split("/")
      .filter(Boolean);

    const postIndex = parts.findIndex(
      (part) => part.toLowerCase() === "p"
    );

    if (postIndex !== -1 && parts[postIndex + 1]) {
      return parts[postIndex + 1];
    }

    const reelIndex = parts.findIndex(
      (part) =>
        part.toLowerCase() === "reel" ||
        part.toLowerCase() === "reels"
    );

    if (reelIndex !== -1 && parts[reelIndex + 1]) {
      return parts[reelIndex + 1];
    }

    return null;
  } catch {
    return null;
  }
}

function sanitizeUrlForLog(url) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);

    return (
      `${parsed.protocol}//` +
      `${parsed.hostname}` +
      `${parsed.pathname.slice(0, 140)}`
    );
  } catch {
    return String(url).slice(0, 180);
  }
}

function isInstagramImageUrl(url) {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname.includes("cdninstagram.com") &&
      !hostname.startsWith("static.")
    ) {
      return true;
    }

    if (
      hostname.includes("fbcdn.net") &&
      !hostname.startsWith("static.")
    ) {
      return true;
    }

    if (hostname.includes("scontent")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function getImageExtension(contentType, url) {
  const type = String(contentType || "").toLowerCase();

  if (type.includes("png")) {
    return ".png";
  }

  if (type.includes("webp")) {
    return ".webp";
  }

  if (type.includes("avif")) {
    return ".avif";
  }

  if (type.includes("jpeg") || type.includes("jpg")) {
    return ".jpg";
  }

  try {
    const pathname = new URL(url).pathname.toLowerCase();

    if (pathname.endsWith(".png")) {
      return ".png";
    }

    if (pathname.endsWith(".webp")) {
      return ".webp";
    }

    if (pathname.endsWith(".avif")) {
      return ".avif";
    }

    if (pathname.endsWith(".jpeg")) {
      return ".jpeg";
    }
  } catch {
    // Ignore.
  }

  return ".jpg";
}

async function getInstagramPostGraphQL(shortcode, postUrl) {
  console.log("Instagram GraphQL post metadata started");
  console.log("Instagram GraphQL shortcode:", shortcode);
  console.log("Instagram GraphQL doc_id:", INSTAGRAM_POST_DOC_ID);

  const variables = {
    shortcode,
    __relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider:
      false,
  };

  const body = new URLSearchParams({
    variables: JSON.stringify(variables),
    doc_id: INSTAGRAM_POST_DOC_ID,
    server_timestamps: "true",
  });

  const response = await fetch(INSTAGRAM_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://www.instagram.com",
      Referer: postUrl || "https://www.instagram.com/",
      "X-Requested-With": "XMLHttpRequest",
      "X-IG-App-ID": "936619743392459",
    },
    body,
  });

  const responseText = await response.text();

  console.log(
    "Instagram GraphQL HTTP status:",
    response.status
  );

  console.log(
    "Instagram GraphQL response length:",
    responseText.length
  );

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    console.log(
      "Instagram GraphQL response preview:",
      responseText.slice(0, 500)
    );

    throw new Error(
      "Instagram GraphQL returned invalid JSON"
    );
  }

  if (Array.isArray(data.errors) && data.errors.length) {
    console.log(
      "Instagram GraphQL errors:",
      JSON.stringify(data.errors).slice(0, 2000)
    );
  }

  if (!data.data) {
    throw new Error("Instagram GraphQL returned no data");
  }

  const webInfo =
    data.data?.xdt_api__v1__media__shortcode__web_info;

  if (!webInfo) {
    console.log(
      "Instagram GraphQL data keys:",
      Object.keys(data.data || {})
    );

    throw new Error(
      "Instagram GraphQL media web_info not found"
    );
  }

  const items = Array.isArray(webInfo.items)
    ? webInfo.items
    : [];

  console.log("Instagram GraphQL media items:", items.length);

  if (!items.length) {
    throw new Error(
      "Instagram GraphQL returned no media items"
    );
  }

  return items[0];
}

function extractImageUrlsFromMedia(media) {
  const urls = new Set();

  const candidates =
    media?.image_versions2?.candidates;

  if (Array.isArray(candidates)) {
    console.log(
      "Instagram GraphQL image candidates:",
      candidates.length
    );

    for (const candidate of candidates) {
      if (isInstagramImageUrl(candidate?.url)) {
        urls.add(candidate.url);
      }
    }
  }

  const carouselMedia = Array.isArray(media?.carousel_media)
    ? media.carousel_media
    : [];

  if (carouselMedia.length) {
    console.log(
      "Instagram GraphQL carousel items:",
      carouselMedia.length
    );

    for (const item of carouselMedia) {
      const itemCandidates =
        item?.image_versions2?.candidates;

      if (Array.isArray(itemCandidates)) {
        for (const candidate of itemCandidates) {
          if (isInstagramImageUrl(candidate?.url)) {
            urls.add(candidate.url);
          }
        }
      }
    }
  }

  console.log(
    "Instagram GraphQL usable image URLs:",
    urls.size
  );

  return [...urls];
}

async function downloadInstagramImage(imageUrls, jobDirectory) {
  console.log(
    "Instagram image download candidates:",
    imageUrls.length
  );

  const candidates = imageUrls.slice(0, 10);
  let lastError = null;

  for (let i = 0; i < candidates.length; i++) {
    const imageUrl = candidates[i];

    console.log(
      `Instagram image candidate ${i + 1}/${candidates.length}:`,
      sanitizeUrlForLog(imageUrl)
    );

    try {
      const response = await fetch(imageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
          Accept:
            "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          Referer: "https://www.instagram.com/",
        },
        redirect: "follow",
      });

      const contentType = (
        response.headers.get("content-type") || ""
      ).toLowerCase();

      console.log(
        `Instagram image candidate ${i + 1} response:`,
        response.status,
        contentType
      );

      if (
        response.ok &&
        contentType.startsWith("image/")
      ) {
        const buffer = Buffer.from(
          await response.arrayBuffer()
        );

        if (!buffer.length) {
          throw new Error("Image response was empty");
        }

        const extension = getImageExtension(
          contentType,
          imageUrl
        );

        const filePath = path.join(
          jobDirectory,
          `instagram_photo${extension}`
        );

        fs.writeFileSync(filePath, buffer);

        console.log(
          "Instagram image download completed:",
          filePath
        );

        console.log(
          "Instagram image size:",
          buffer.length
        );

        return filePath;
      }

      lastError = new Error(
        `HTTP ${response.status} ${contentType}`
      );
    } catch (error) {
      lastError = error;

      console.log(
        `Instagram image candidate ${i + 1} failed:`,
        error?.message || error
      );
    }
  }

  throw new Error(
    "No usable Instagram image found. " +
      `Last error: ${lastError?.message || "unknown error"}`
  );
}

async function downloadInstagramPost(url, jobDirectory) {
  const shortcode = extractInstagramShortcode(url);

  if (!shortcode) {
    throw new Error(
      "Instagram post shortcode could not be extracted"
    );
  }

  const media = await getInstagramPostGraphQL(
    shortcode,
    url
  );

  console.log("Instagram GraphQL media type:", media?.media_type);
  console.log("Instagram GraphQL media code:", media?.code);
  console.log("Instagram GraphQL media pk:", media?.pk);

  const imageUrls = extractImageUrlsFromMedia(media);

  if (!imageUrls.length) {
    throw new Error(
      "Instagram GraphQL returned media but no image candidates"
    );
  }

  const filePath = await downloadInstagramImage(
    imageUrls,
    jobDirectory
  );

  return {
    success: true,
    filePath,
    fileSize: fs.statSync(filePath).size,
    contentType: "PHOTO",
    mediaType: media?.media_type === 8 ? "CAROUSEL" : "PHOTO",
    sourceUrl: url,
    finalCost: null,
  };
}

function isRateLimitError(error) {
  const message = error?.message || String(error || "");

  return (
    message.includes("429") ||
    message.includes("Too Many Requests") ||
    message.includes("HTTP Error 429") ||
    error?.code === "INSTAGRAM_RATE_LIMITED"
  );
}

async function downloadWithBrowserFallback({
  url,
  jobId,
  contentType,
}) {
  console.log("Instagram browser fallback started.");

  try {
    const result = await downloadInstagramWithBrowser({
      url,
      jobId,
      contentType,
    });

    if (!result?.success || !result.filePath) {
      throw new Error(
        "Instagram browser fallback completed without a file"
      );
    }

    console.log(
      "Instagram browser fallback completed:",
      result.filePath
    );

    return {
      success: true,
      filePath: result.filePath,
      fileSize:
        result.fileSize ||
        fs.statSync(result.filePath).size,
      contentType:
        result.contentType ||
        detectFileContentType(result.filePath),
      mediaType: result.mediaType || "UNKNOWN",
      sourceUrl: result.sourceUrl || url,
      contentId: result.contentId || null,
      finalCost: null,
    };
  } catch (error) {
    console.error(
      "Instagram browser fallback failed:",
      error?.message || String(error)
    );

    throw error;
  }
}

async function downloadInstagramMedia({
  url,
  jobId,
  contentType = "OTHER",
}) {
  const normalizedUrl = cleanInstagramUrl(url);

  const normalizedContentType =
    normalizeContentType(contentType);

  console.log("Instagram download started:", jobId);

  const {
    jobDirectory,
    outputTemplate,
  } = createOutputTemplate(jobId);

  if (normalizedContentType === "PROFILE") {
    console.log("Instagram profile URL detected.");

    const result = await downloadInstagramProfile({
      url: normalizedUrl,
      jobId,
    });

    if (!result?.success || !result.filePath) {
      throw new Error(
        "Instagram profile picture download failed"
      );
    }

    return {
      success: true,
      filePath: result.filePath,
      fileSize:
        result.fileSize ||
        fs.statSync(result.filePath).size,
      contentType: "PHOTO",
      mediaType: "PROFILE",
      sourceUrl: normalizedUrl,
      finalCost: null,
    };
  }

  if (normalizedContentType === "POST") {
    try {
      return await downloadInstagramPost(
        normalizedUrl,
        jobDirectory
      );
    } catch (error) {
      console.log(
        "Instagram GraphQL photo download failed:",
        error?.message || error
      );

      throw error;
    }
  }

  console.log(
    "Instagram requested content type:",
    normalizedContentType
  );

  const format = getDownloadFormat(
    normalizedContentType
  );

  console.log("Instagram selected format:", format);

  function getDownloadedFiles() {
    return getNonEmptyMediaFiles(jobDirectory);
  }

  function makeResult(filePath, caption = "") {
    return makeSuccessResult({
      filePath,
      mediaType: normalizedContentType,
      sourceUrl: normalizedUrl,
      caption,
    });
  }

  async function tryGalleryDl() {
    console.log(
      "Instagram gallery-dl fallback started without cookies."
    );

    if (normalizedContentType === "STORY") {
      return await downloadStoryWithGalleryDl({
        url: normalizedUrl,
        jobDirectory,
      });
    }

    await execFileAsync(
      "gallery-dl",
      [
        "-D",
        jobDirectory,
        "--no-mtime",
        normalizedUrl,
      ],
      {
        timeout: 90000,
        maxBuffer: 5 * 1024 * 1024,
      }
    );

    const files = sortMediaFiles(
      getDownloadedFiles()
    );

    if (!files.length) {
      throw new Error(
        "gallery-dl completed without supported media."
      );
    }

    return makeResult(files[0]);
  }

  let instagramCaption = "";

  
  let instagramCaption = "";
  let primaryCookiePath = null;

  try {
    try {
      primaryCookiePath = await createInstagramCookieFile(
        jobDirectory
      );
    } catch (cookieError) {
      console.error(
        "Instagram primary cookie preparation failed:",
        cookieError?.message || String(cookieError)
      );
    }

    const downloadOptions = {
      output: outputTemplate,
      format,
      noPlaylist: true,
      noWarnings: true,
      print: "description",
    };

    if (primaryCookiePath) {
      downloadOptions.cookies = primaryCookiePath;
    }

    const downloadResult = await ytdlp(
      normalizedUrl,
      downloadOptions
    );

    instagramCaption = String(
      downloadResult?.stdout || ""
    ).trim();

    console.log(
      "Instagram yt-dlp diagnostic:",
      JSON.stringify({
        stdout: instagramCaption,
        stderr: downloadResult?.stderr || "",
        cookieProvided: Boolean(primaryCookiePath),
        jobDirectory,
        outputTemplate,
        files: getDownloadedFiles().map(
          (file) => path.basename(file)
        ),
      })
    );
  } catch (error) {
    console.log(
      "Instagram yt-dlp download failed:",
      error?.stderr || error?.message || String(error)
    );

    if (isRateLimitError(error)) {
      console.log(
        "Instagram rate limit detected on initial yt-dlp attempt."
      );
    }
  } finally {
    if (primaryCookiePath) {
      try {
        fs.unlinkSync(primaryCookiePath);
      } catch (cleanupError) {
        console.error(
          "Instagram primary cookie cleanup failed:",
          cleanupError?.message || String(cleanupError)
        );
      }
    }
  }

  let files = sortMediaFiles(getDownloadedFiles());

  if (files.length) {
    console.log(
      "Instagram yt-dlp download completed:",
      files[0]
    );

    return makeResult(files[0], instagramCaption);
  }

  try {
    const galleryResult = await tryGalleryDl();

    if (galleryResult?.success && galleryResult.filePath) {
      return galleryResult;
    }
  } catch (error) {
    console.error(
      "Instagram gallery-dl fallback failed:",
      error?.stderr || error?.message || String(error)
    );
  }

  try {
    const browserResult = await downloadWithBrowserFallback({
      url: normalizedUrl,
      jobId,
      contentType: normalizedContentType,
    });

    if (
      browserResult?.success &&
      browserResult.filePath
    ) {
      return browserResult;
    }

    throw new Error(
      "Browser fallback returned no media file."
    );
  } catch (error) {
    console.error(
      "Instagram browser fallback failed:",
      error?.message || String(error)
    );
  }

  console.log(
    "Instagram cookie fallback is starting as the final method."
  );

  let cookiePath = null;

  try {
    cookiePath = await createInstagramCookieFile(
      jobDirectory
    );

    if (!cookiePath) {
      throw new Error(
        "No saved Instagram cookie is configured."
      );
    }

    const cookieResult = await ytdlp(
      normalizedUrl,
      {
        output: outputTemplate,
        format,
        noPlaylist: true,
        noWarnings: true,
        cookies: cookiePath,
        print: "description",
      }
    );

    instagramCaption = String(
      cookieResult?.stdout || ""
    ).trim();

    files = sortMediaFiles(getDownloadedFiles());

    if (!files.length) {
      throw new Error(
        "Cookie fallback completed without supported media."
      );
    }

    console.log(
      "Instagram final cookie fallback completed:",
      files[0]
    );

    return makeResult(files[0], instagramCaption);
  } catch (error) {
    console.error(
      "Instagram final cookie fallback failed:",
      error?.stderr || error?.message || String(error)
    );

    throw new Error(
      "Instagram download failed after yt-dlp, gallery-dl, browser, and final cookie fallback. " +
        (error?.message || String(error))
    );
  } finally {
    if (cookiePath) {
      try {
        fs.unlinkSync(cookiePath);
      } catch (cleanupError) {
        console.error(
          "Instagram cookie file cleanup failed:",
          cleanupError?.message || String(cleanupError)
        );
      }
    }
  }
}

module.exports = {
  downloadInstagramMedia,
  extractInstagramShortcode,
  detectFileContentType,
};
