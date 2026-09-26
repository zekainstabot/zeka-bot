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

function detectInstagramMediaType(
  metadata,
  url
) {
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
      [
        "jpg",
        "jpeg",
        "png",
        "webp",
        "avif",
      ].includes(ext)
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
      "avif",
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
    ].includes(ext) ||
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

async function getInstagramPostHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",

      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

      "Accept-Language":
        "en-US,en;q=0.9",
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

function decodeInstagramUrl(value) {
  if (!value) {
    return null;
  }

  let decoded = value;

  decoded = decoded
    .replace(/\\u0026/g, "&")
    .replace(/\\u003D/g, "=")
    .replace(/\\u002F/g, "/")
    .replace(/\\u003A/g, ":")
    .replace(/\\u0025/g, "%")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");

  try {
    decoded = JSON.parse(
      `"${decoded}"`
    );
  } catch {
    // Keep decoded value.
  }

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

  if (
    parsed.protocol !== "https:"
  ) {
    return false;
  }

  const hostname =
    parsed.hostname.toLowerCase();

  /*
   * Instagram image CDN domains.
   *
   * فقط CDNهای واقعی را قبول می‌کنیم.
   * دامنه‌هایی مثل:
   *
   * static.cdninstagram.com
   * www.instagram.com
   * instagram.com
   *
   * قبول نمی‌شوند.
   */

  if (
    hostname.startsWith(
      "scontent"
    ) &&
    hostname.includes(
      "cdninstagram.com"
    )
  ) {
    return true;
  }

  if (
    hostname.includes(
      "fbcdn.net"
    ) &&
    !hostname.startsWith(
      "static."
    )
  ) {
    return true;
  }

  if (
    hostname.includes(
      "cdninstagram.com"
    ) &&
    !hostname.startsWith(
      "static."
    )
  ) {
    return true;
  }

  return false;
}

function extractInstagramImageUrls(html) {
  const urls = new Set();

  /*
   * فقط فیلدهایی که احتمالاً واقعاً
   * مربوط به تصویر پست هستند.
   *
   * src عمداً حذف شده.
   * چون باعث پیدا شدن صدها فایل CSS/JS می‌شد.
   */

  const patterns = [
    /"display_url"\s*:\s*"([^"]+)"/g,

    /"image_url"\s*:\s*"([^"]+)"/g,

    /"thumbnail_src"\s*:\s*"([^"]+)"/g,

    /"thumbnail_url"\s*:\s*"([^"]+)"/g,

    /"displayUrl"\s*:\s*"([^"]+)"/g,

    /"imageUrl"\s*:\s*"([^"]+)"/g,
  ];

  for (
    const pattern of patterns
  ) {
    let match;

    while (
      (match = pattern.exec(html)) !== null
    ) {
      const decoded =
        decodeInstagramUrl(
          match[1]
        );

      if (
        isInstagramImageUrl(
          decoded
        )
      ) {
        urls.add(decoded);
      }
    }
  }

  return [...urls];
}

function getImageExtension(
  contentType,
  url
) {
  const normalizedContentType =
    String(
      contentType || ""
    ).toLowerCase();

  if (
    normalizedContentType.includes(
      "png"
    )
  ) {
    return ".png";
  }

  if (
    normalizedContentType.includes(
      "webp"
    )
  ) {
    return ".webp";
  }

  if (
    normalizedContentType.includes(
      "avif"
    )
  ) {
    return ".avif";
  }

  if (
    normalizedContentType.includes(
      "jpeg"
    ) ||
    normalizedContentType.includes(
      "jpg"
    )
  ) {
    return ".jpg";
  }

  try {
    const pathname =
      new URL(url).pathname.toLowerCase();

    if (
      pathname.endsWith(".png")
    ) {
      return ".png";
    }

    if (
      pathname.endsWith(".webp")
    ) {
      return ".webp";
    }

    if (
      pathname.endsWith(".avif")
    ) {
      return ".avif";
    }

    if (
      pathname.endsWith(".jpeg")
    ) {
      return ".jpeg";
    }
  } catch {
    // Ignore invalid URL.
  }

  return ".jpg";
}

async function downloadInstagramImage(
  imageUrls,
  jobDirectory
) {
  console.log(
    "Instagram direct image candidates:",
    imageUrls.length
  );

  let lastError = null;

  for (
    let i = 0;
    i < imageUrls.length;
    i++
  ) {
    const imageUrl =
      imageUrls[i];

    try {
      const response =
        await fetch(
          imageUrl,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",

              Accept:
                "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",

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

      /*
       * فقط مواردی که واقعاً
       * image هستند لاگ می‌شوند.
       *
       * دیگر 492 خط CSS/JS
       * تولید نمی‌کنیم.
       */

      if (
        !response.ok
      ) {
        lastError =
          new Error(
            `HTTP ${response.status}`
          );

        continue;
      }

      if (
        !contentType.startsWith(
          "image/"
        )
      ) {
        lastError =
          new Error(
            `Non-image content: ${
              contentType ||
              "unknown"
            }`
          );

        continue;
      }

      console.log(
        "Instagram usable image found:",
        contentType
      );

      const buffer =
        Buffer.from(
          await response.arrayBuffer()
        );

      if (
        !buffer.length
      ) {
        lastError =
          new Error(
            "Image response was empty"
          );

        continue;
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
    } catch (error) {
      lastError = error;
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

async function getInstagramMetadata(
  url
) {
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
   * POST
   *
   * ابتدا HTML مستقیم Instagram.
   */

  if (
    normalizedContentType ===
    "POST"
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

        if (
          imageUrls.length
        ) {
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

    /*
     * مهم:
     *
     * اگر POST بود و HTML نتوانست
     * تصویر را استخراج کند، دیگر
     * yt-dlp را برای عکس اجرا نمی‌کنیم.
     *
     * چون yt-dlp قبلاً ثابت کرده:
     *
     * There is no video in this post
     */

    throw new Error(
      "Instagram photo URL could not be extracted from direct HTML"
    );
  }

  /*
   * Reel / Story / Video
   *
   * مسیر yt-dlp
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
      output:
        outputTemplate,

      format,

      noPlaylist: true,

      noWarnings: true,

      noCheckCertificates: true,
    }
  );

  const files =
    fs
      .readdirSync(
        jobDirectory
      )
      .map((file) =>
        path.join(
          jobDirectory,
          file
        )
      )
      .filter((file) =>
        fs.statSync(
          file
        ).isFile()
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
