const fs = require("fs");
const path = require("path");
const os = require("os");
const ytdlp = require("yt-dlp-exec");

const DOWNLOAD_ROOT = path.join(
  os.tmpdir(),
  "zeka-instagram"
);

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

function detectInstagramMediaType(metadata, url) {
  if (!metadata) {
    return "UNKNOWN";
  }

  if (
    Array.isArray(metadata.entries) &&
    metadata.entries.length > 1
  ) {
    return "CAROUSEL";
  }

  if (metadata._type === "playlist") {
    return "CAROUSEL";
  }

  const normalizedUrl =
    String(url || "").toLowerCase();

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
    const ext = String(
      metadata.ext || ""
    ).toLowerCase();

    if (
      ["jpg", "jpeg", "png", "webp", "avif"].includes(ext)
    ) {
      return "PHOTO";
    }

    return "VIDEO";
  }

  const ext = String(
    metadata.ext || ""
  ).toLowerCase();

  if (
    ["jpg", "jpeg", "png", "webp", "avif"].includes(ext)
  ) {
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
  const ext = path
    .extname(filePath)
    .toLowerCase();

  if (
    [".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(ext)
  ) {
    return "PHOTO";
  }

  if (
    [".mp4", ".mov", ".webm", ".mkv"].includes(ext)
  ) {
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

      "Accept-Language":
        "en-US,en;q=0.9",

      "Cache-Control":
        "no-cache",

      Pragma:
        "no-cache",
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

function decodeInstagramValue(value) {
  if (!value) {
    return null;
  }

  let decoded = String(value);

  decoded = decoded
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u002f/gi, "/")
    .replace(/\\u003a/gi, ":")
    .replace(/\\u0025/gi, "%")
    .replace(/\\u002e/gi, ".")
    .replace(/\\u002d/gi, "-")
    .replace(/\\u003f/gi, "?")
    .replace(/\\u0023/gi, "#")
    .replace(/\\u005c/gi, "\\")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&");

  return decoded;
}

function isInstagramImageUrl(url) {
  if (!url) {
    return false;
  }

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") {
    return false;
  }

  const hostname =
    parsed.hostname.toLowerCase();

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

  if (
    hostname.includes("scontent")
  ) {
    return true;
  }

  return false;
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
      `${parsed.pathname.slice(0, 120)}`
    );
  } catch {
    return String(url).slice(0, 160);
  }
}

function extractCdnUrlsFromText(text) {
  const results = new Set();

  if (!text) {
    return [];
  }

  const decodedText =
    decodeInstagramValue(text);

  const patterns = [
    /https?:\/\/[^"'\\<>\s]+/gi,

    /https?:\\\/\\\/[^"'\\<>\s]+/gi,

    /https?:\\u002f\\u002f[^"'\\<>\s]+/gi,
  ];

  for (const pattern of patterns) {
    let match;

    while (
      (match = pattern.exec(decodedText)) !== null
    ) {
      let url =
        decodeInstagramValue(
          match[0]
        );

      url = url.replace(
        /[\\"]+$/g,
        ""
      );

      if (
        isInstagramImageUrl(url)
      ) {
        results.add(url);
      }
    }
  }

  return [...results];
}

function extractMetaImageUrls(html) {
  const urls = new Set();

  const pattern =
    /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:url|og:image:secure_url|twitter:image)["'][^>]+content=["']([^"']+)["'][^>]*>/gi;

  let match;

  while (
    (match = pattern.exec(html)) !== null
  ) {
    const url =
      decodeInstagramValue(
        match[1]
      );

    if (
      isInstagramImageUrl(url)
    ) {
      urls.add(url);
    }
  }

  return [...urls];
}

function extractJsonLdBlocks(html) {
  const blocks = [];

  const pattern =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;

  while (
    (match = pattern.exec(html)) !== null
  ) {
    blocks.push(match[1]);
  }

  return blocks;
}

function collectImageUrlsFromObject(
  value,
  urls = [],
  depth = 0
) {
  if (depth > 12 || value == null) {
    return urls;
  }

  if (typeof value === "string") {
    const decoded =
      decodeInstagramValue(value);

    if (
      isInstagramImageUrl(decoded)
    ) {
      urls.push(decoded);
    }

    return urls;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectImageUrlsFromObject(
        item,
        urls,
        depth + 1
      );
    }

    return urls;
  }

  if (
    typeof value === "object"
  ) {
    for (const [key, item] of Object.entries(value)) {
      const normalizedKey =
        key.toLowerCase();

      if (
        normalizedKey.includes("image") ||
        normalizedKey.includes("thumbnail") ||
        normalizedKey.includes("contenturl") ||
        normalizedKey.includes("displayurl") ||
        normalizedKey.includes("candidate") ||
        normalizedKey.includes("original")
      ) {
        collectImageUrlsFromObject(
          item,
          urls,
          depth + 1
        );
      } else if (
        typeof item === "object"
      ) {
        collectImageUrlsFromObject(
          item,
          urls,
          depth + 1
        );
      }
    }
  }

  return urls;
}

function extractJsonLdImageUrls(html) {
  const urls = new Set();

  const blocks =
    extractJsonLdBlocks(html);

  console.log(
    "Instagram JSON-LD blocks found:",
    blocks.length
  );

  for (
    let i = 0;
    i < blocks.length;
    i++
  ) {
    const block =
      blocks[i].trim();

    if (!block) {
      continue;
    }

    try {
      const parsed =
        JSON.parse(block);

      const found =
        collectImageUrlsFromObject(
          parsed
        );

      for (const url of found) {
        urls.add(url);
      }

      if (found.length) {
        console.log(
          `Instagram JSON-LD block ${i + 1} image URLs:`,
          found.length
        );

        for (
          const url of found.slice(0, 5)
        ) {
          console.log(
            "Instagram JSON-LD image:",
            sanitizeUrlForLog(url)
          );
        }
      }
    } catch (error) {
      console.log(
        `Instagram JSON-LD block ${i + 1} parse failed`
      );
    }
  }

  return [...urls];
}

function logRelevantHtmlContexts(html) {
  const markers = [
    "image_versions2",
    "image_versions",
    "shortcode_media",
    "xdt_api__v1__media",
    "display_url",
    "displayUrl",
    "image_url",
    "imageUrl",
    "thumbnail_url",
    "thumbnailUrl",
    "thumbnail_src",
    "carousel_media",
    "og:image",
    "contentUrl",
    "content_url",
    "scontent",
    "cdninstagram",
    "fbcdn",
  ];

  const lowerHtml =
    html.toLowerCase();

  for (const marker of markers) {
    const lowerMarker =
      marker.toLowerCase();

    const index =
      lowerHtml.indexOf(
        lowerMarker
      );

    if (index === -1) {
      continue;
    }

    const start =
      Math.max(
        0,
        index - 300
      );

    const end =
      Math.min(
        html.length,
        index + 1200
      );

    let snippet =
      html.slice(
        start,
        end
      );

    snippet =
      snippet.replace(
        /\s+/g,
        " "
      );

    console.log(
      `Instagram relevant marker "${marker}" found`
    );

    console.log(
      `Instagram relevant context "${marker}":`,
      snippet
    );
  }
}

function extractInstagramImageUrls(html) {
  const urls = new Set();

  /*
   * 1. Meta tags
   */
  const metaUrls =
    extractMetaImageUrls(html);

  for (const url of metaUrls) {
    urls.add(url);
  }

  console.log(
    "Instagram meta image URLs:",
    metaUrls.length
  );

  /*
   * 2. JSON-LD
   */
  const jsonLdUrls =
    extractJsonLdImageUrls(
      html
    );

  for (const url of jsonLdUrls) {
    urls.add(url);
  }

  /*
   * 3. Known Instagram fields
   */
  const knownPatterns = [
    /"display_url"\s*:\s*"([^"]+)"/gi,

    /"displayUrl"\s*:\s*"([^"]+)"/gi,

    /"image_url"\s*:\s*"([^"]+)"/gi,

    /"imageUrl"\s*:\s*"([^"]+)"/gi,

    /"thumbnail_url"\s*:\s*"([^"]+)"/gi,

    /"thumbnailUrl"\s*:\s*"([^"]+)"/gi,

    /"thumbnail_src"\s*:\s*"([^"]+)"/gi,

    /"contentUrl"\s*:\s*"([^"]+)"/gi,

    /"content_url"\s*:\s*"([^"]+)"/gi,

    /"original"\s*:\s*"([^"]+)"/gi,
  ];

  for (
    const pattern of knownPatterns
  ) {
    let match;

    while (
      (match = pattern.exec(html)) !== null
    ) {
      const url =
        decodeInstagramValue(
          match[1]
        );

      if (
        isInstagramImageUrl(url)
      ) {
        urls.add(url);
      }
    }
  }

  console.log(
    "Instagram known-field image URLs:",
    urls.size
  );

  /*
   * 4. مستقیم دنبال URLهای CDN
   */
  const directUrls =
    extractCdnUrlsFromText(
      html
    );

  console.log(
    "Instagram direct CDN image URLs:",
    directUrls.length
  );

  for (const url of directUrls) {
    urls.add(url);
  }

  /*
   * تشخیص ساختار واقعی صفحه.
   */
  if (!urls.size) {
    logRelevantHtmlContexts(
      html
    );
  }

  return [...urls];
}

async function downloadInstagramImage(
  imageUrls,
  jobDirectory
) {
  console.log(
    "Instagram direct image candidates:",
    imageUrls.length
  );

  const candidates =
    imageUrls.slice(0, 10);

  let lastError = null;

  for (
    let i = 0;
    i < candidates.length;
    i++
  ) {
    const imageUrl =
      candidates[i];

    console.log(
      `Instagram testing image candidate ${i + 1}/${candidates.length}:`,
      sanitizeUrlForLog(imageUrl)
    );

    try {
      const response =
        await fetch(
          imageUrl,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",

              Accept:
                "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",

              Referer:
                "https://www.instagram.com/",
            },

            redirect: "follow",
          }
        );

      const contentType =
        (
          response.headers.get(
            "content-type"
          ) || ""
        ).toLowerCase();

      console.log(
        `Instagram image candidate ${i + 1} response:`,
        response.status,
        contentType
      );

      if (
        response.ok &&
        contentType.startsWith(
          "image/"
        )
      ) {
        const buffer =
          Buffer.from(
            await response.arrayBuffer()
          );

        if (!buffer.length) {
          throw new Error(
            "Image response was empty"
          );
        }

        const extension =
          getImageExtension(
            contentType,
            imageUrl
          );

        const filePath =
          path.join(
            jobDirectory,
            `instagram_photo${extension}`
          );

        fs.writeFileSync(
          filePath,
          buffer
        );

        console.log(
          "Instagram direct image download completed:",
          filePath
        );

        console.log(
          "Instagram direct image size:",
          buffer.length
        );

        return filePath;
      }

      lastError =
        new Error(
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
      `Last error: ${
        lastError?.message ||
        "unknown error"
      }`
  );
}

function getImageExtension(
  contentType,
  url
) {
  const type =
    String(
      contentType || ""
    ).toLowerCase();

  if (type.includes("png")) {
    return ".png";
  }

  if (type.includes("webp")) {
    return ".webp";
  }

  if (type.includes("avif")) {
    return ".avif";
  }

  if (
    type.includes("jpeg") ||
    type.includes("jpg")
  ) {
    return ".jpg";
  }

  try {
    const pathname =
      new URL(url)
        .pathname
        .toLowerCase();

    if (pathname.endsWith(".png")) {
      return ".png";
    }

    if (pathname.endsWith(".webp")) {
      return ".webp";
    }

    if (pathname.endsWith(".avif")) {
      return ".avif";
    }

    if (
      pathname.endsWith(".jpeg")
    ) {
      return ".jpeg";
    }
  } catch {
    // Ignore.
  }

  return ".jpg";
}

async function getInstagramMetadata(url) {
  console.log(
    "Instagram metadata extraction started"
  );

  try {
    const metadata =
      await ytdlp(
        url,
        {
          noPlaylist: true,
          noWarnings: true,
          noCheckCertificates: true,
          dumpSingleJson: true,
          skipDownload: true,
        }
      );

    console.log(
      "Instagram metadata extraction completed"
    );

    return metadata;
  } catch (error) {
    console.log(
      "Instagram metadata extraction failed:",
      error?.message || error
    );

    return null;
  }
}

async function downloadInstagramMedia({
  url,
  jobId,
  contentType = "OTHER",
}) {
  const normalizedUrl =
    cleanInstagramUrl(url);

  const normalizedContentType =
    normalizeContentType(
      contentType
    );

  console.log(
    "Instagram download started:",
    jobId
  );

  const {
    jobDirectory,
    outputTemplate,
  } = createOutputTemplate(
    jobId
  );

  /*
   * PHOTO / POST
   */
  if (
    normalizedContentType === "POST"
  ) {
    try {
      console.log(
        "Instagram direct HTML photo extraction started"
      );

      const htmlResult =
        await getInstagramPostHtml(
          normalizedUrl
        );

      console.log(
        "Instagram direct HTML status:",
        htmlResult.status
      );

      console.log(
        "Instagram direct HTML final URL:",
        htmlResult.finalUrl
      );

      console.log(
        "Instagram direct HTML length:",
        htmlResult.html.length
      );

      if (
        htmlResult.status >= 200 &&
        htmlResult.status < 300
      ) {
        const imageUrls =
          extractInstagramImageUrls(
            htmlResult.html
          );

        console.log(
          "Instagram direct HTML image URLs found:",
          imageUrls.length
        );

        for (
          const imageUrl of imageUrls.slice(
            0,
            5
          )
        ) {
          console.log(
            "Instagram extracted image:",
            sanitizeUrlForLog(
              imageUrl
            )
          );
        }

        if (imageUrls.length) {
          const filePath =
            await downloadInstagramImage(
              imageUrls,
              jobDirectory
            );

          return {
            filePath,
            contentType: "PHOTO",
            mediaType: "PHOTO",
            finalCost: null,
          };
        }
      }
    } catch (error) {
      console.log(
        "Instagram direct HTML photo extraction failed:",
        error?.message || error
      );
    }

    throw new Error(
      "Instagram photo URL could not be extracted from direct HTML"
    );
  }

  /*
   * REEL / STORY / VIDEO
   */
  const metadata =
    await getInstagramMetadata(
      normalizedUrl
    );

  const mediaType =
    detectInstagramMediaType(
      metadata,
      normalizedUrl
    );

  console.log(
    "Instagram requested content type:",
    normalizedContentType
  );

  console.log(
    "Instagram detected media type:",
    mediaType
  );

  const format =
    getDownloadFormat(
      normalizedContentType
    );

  console.log(
    "Instagram selected format:",
    format
  );

  console.log(
    "Instagram yt-dlp download started:",
    normalizedUrl
  );

  await ytdlp(
    normalizedUrl,
    {
      output: outputTemplate,
      format,
      noPlaylist: true,
      noWarnings: true,
      noCheckCertificates: true,
    }
  );

  const files =
    fs
      .readdirSync(jobDirectory)
      .map((file) =>
        path.join(
          jobDirectory,
          file
        )
      )
      .filter((file) =>
        fs.statSync(file).isFile()
      );

  if (!files.length) {
    throw new Error(
      "Instagram download completed but no file was found"
    );
  }

  const filePath =
    files[0];

  console.log(
    "Instagram download completed:",
    filePath
  );

  return {
    filePath,
    contentType:
      detectFileContentType(
        filePath
      ),
    mediaType,
    finalCost: null,
  };
}

module.exports = {
  downloadInstagramMedia,
  getInstagramMetadata,
  getInstagramPostHtml,
  extractInstagramImageUrls,
  detectInstagramMediaType,
  detectFileContentType,
};
