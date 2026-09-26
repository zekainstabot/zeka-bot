const fs = require("fs");
const path = require("path");
const os = require("os");
const ytdlp = require("yt-dlp-exec");

const DOWNLOAD_ROOT = path.join(
  os.tmpdir(),
  "zeka-instagram"
);

const INSTAGRAM_GRAPHQL_URL =
  "https://www.instagram.com/graphql/query";

const INSTAGRAM_POST_DOC_ID =
  "27128499623469141";

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

function extractInstagramShortcode(url) {
  try {
    const parsed =
      new URL(url);

    const parts =
      parsed.pathname
        .split("/")
        .filter(Boolean);

    const postIndex =
      parts.findIndex(
        (part) =>
          part.toLowerCase() === "p"
      );

    if (
      postIndex !== -1 &&
      parts[postIndex + 1]
    ) {
      return parts[
        postIndex + 1
      ];
    }

    const reelIndex =
      parts.findIndex(
        (part) =>
          part.toLowerCase() ===
            "reel" ||
          part.toLowerCase() ===
            "reels"
      );

    if (
      reelIndex !== -1 &&
      parts[reelIndex + 1]
    ) {
      return parts[
        reelIndex + 1
      ];
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
    const parsed =
      new URL(url);

    return (
      `${parsed.protocol}//` +
      `${parsed.hostname}` +
      `${parsed.pathname.slice(
        0,
        140
      )}`
    );
  } catch {
    return String(url).slice(
      0,
      180
    );
  }
}

function isInstagramImageUrl(url) {
  if (!url) {
    return false;
  }

  try {
    const parsed =
      new URL(url);

    if (
      parsed.protocol !==
      "https:"
    ) {
      return false;
    }

    const hostname =
      parsed.hostname.toLowerCase();

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
        "scontent"
      )
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function getImageExtension(
  contentType,
  url
) {
  const type =
    String(
      contentType || ""
    ).toLowerCase();

  if (
    type.includes("png")
  ) {
    return ".png";
  }

  if (
    type.includes("webp")
  ) {
    return ".webp";
  }

  if (
    type.includes("avif")
  ) {
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

    if (
      pathname.endsWith(
        ".png"
      )
    ) {
      return ".png";
    }

    if (
      pathname.endsWith(
        ".webp"
      )
    ) {
      return ".webp";
    }

    if (
      pathname.endsWith(
        ".avif"
      )
    ) {
      return ".avif";
    }

    if (
      pathname.endsWith(
        ".jpeg"
      )
    ) {
      return ".jpeg";
    }
  } catch {
    // Ignore.
  }

  return ".jpg";
}

async function getInstagramPostHtml(url) {
  const response =
    await fetch(url, {
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

  const html =
    await response.text();

  return {
    status:
      response.status,

    finalUrl:
      response.url,

    html,
  };
}

/*
 * Instagram GraphQL
 *
 * مسیر جدید:
 *
 * doc_id:
 * 27128499623469141
 *
 * response:
 * data
 *   -> xdt_api__v1__media__shortcode__web_info
 *   -> items
 */
async function getInstagramPostGraphQL(
  shortcode,
  postUrl
) {
  console.log(
    "Instagram GraphQL post metadata started"
  );

  console.log(
    "Instagram GraphQL shortcode:",
    shortcode
  );

  console.log(
    "Instagram GraphQL doc_id:",
    INSTAGRAM_POST_DOC_ID
  );

  const variables = {
    shortcode,

    __relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider:
      false,
  };

  const body =
    new URLSearchParams({
      variables:
        JSON.stringify(
          variables
        ),

      doc_id:
        INSTAGRAM_POST_DOC_ID,

      server_timestamps:
        "true",
    });

  const response =
    await fetch(
      INSTAGRAM_GRAPHQL_URL,
      {
        method: "POST",

        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",

          Accept:
            "*/*",

          "Accept-Language":
            "en-US,en;q=0.9",

          "Content-Type":
            "application/x-www-form-urlencoded",

          Origin:
            "https://www.instagram.com",

          Referer:
            postUrl ||
            "https://www.instagram.com/",

          "X-Requested-With":
            "XMLHttpRequest",

          "X-IG-App-ID":
            "936619743392459",
        },

        body,
      }
    );

  const responseText =
    await response.text();

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
    data =
      JSON.parse(
        responseText
      );
  } catch {
    console.log(
      "Instagram GraphQL response is not JSON"
    );

    console.log(
      "Instagram GraphQL response preview:",
      responseText.slice(
        0,
        500
      )
    );

    throw new Error(
      "Instagram GraphQL returned invalid JSON"
    );
  }

  if (
    Array.isArray(
      data.errors
    ) &&
    data.errors.length
  ) {
    console.log(
      "Instagram GraphQL errors:",
      JSON.stringify(
        data.errors
      ).slice(0, 2000)
    );
  }

  if (!data.data) {
    throw new Error(
      "Instagram GraphQL returned no data"
    );
  }

  const webInfo =
    data.data
      ?.xdt_api__v1__media__shortcode__web_info;

  if (!webInfo) {
    console.log(
      "Instagram GraphQL web_info not found"
    );

    console.log(
      "Instagram GraphQL data keys:",
      Object.keys(
        data.data || {}
      )
    );

    throw new Error(
      "Instagram GraphQL media web_info not found"
    );
  }

  const items =
    Array.isArray(
      webInfo.items
    )
      ? webInfo.items
      : [];

  console.log(
    "Instagram GraphQL media items:",
    items.length
  );

  if (!items.length) {
    throw new Error(
      "Instagram GraphQL returned no media items"
    );
  }

  return items[0];
}

function extractImageUrlsFromMedia(
  media
) {
  const urls =
    new Set();

  const candidates =
    media
      ?.image_versions2
      ?.candidates;

  if (
    Array.isArray(
      candidates
    )
  ) {
    console.log(
      "Instagram GraphQL image candidates:",
      candidates.length
    );

    for (
      const candidate of candidates
    ) {
      const url =
        candidate?.url;

      if (
        isInstagramImageUrl(
          url
        )
      ) {
        urls.add(url);
      }
    }
  }

  /*
   * بعض نسخه‌های پاسخ ممکن است
   * image_versions2 را داخل carousel_media
   * قرار دهند.
   */

  const carouselMedia =
    Array.isArray(
      media?.carousel_media
    )
      ? media.carousel_media
      : [];

  if (
    carouselMedia.length
  ) {
    console.log(
      "Instagram GraphQL carousel items:",
      carouselMedia.length
    );

    for (
      const item of carouselMedia
    ) {
      const itemCandidates =
        item
          ?.image_versions2
          ?.candidates;

      if (
        Array.isArray(
          itemCandidates
        )
      ) {
        for (
          const candidate of itemCandidates
        ) {
          const url =
            candidate?.url;

          if (
            isInstagramImageUrl(
              url
            )
          ) {
            urls.add(url);
          }
        }
      }
    }
  }

  console.log(
    "Instagram GraphQL usable image URLs:",
    urls.size
  );

  return [
    ...urls,
  ];
}

async function downloadInstagramImage(
  imageUrls,
  jobDirectory
) {
  console.log(
    "Instagram image download candidates:",
    imageUrls.length
  );

  const candidates =
    imageUrls.slice(
      0,
      10
    );

  let lastError =
    null;

  for (
    let i = 0;
    i < candidates.length;
    i++
  ) {
    const imageUrl =
      candidates[i];

    console.log(
      `Instagram image candidate ${i + 1}/${candidates.length}:`,
      sanitizeUrlForLog(
        imageUrl
      )
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

            redirect:
              "follow",
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

        if (
          !buffer.length
        ) {
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
          "Instagram image download completed:",
          filePath
        );

        console.log(
          "Instagram image size:",
          buffer.length
        );

        return filePath;
      }

      lastError =
        new Error(
          `HTTP ${response.status} ${contentType}`
        );
    } catch (
      error
    ) {
      lastError =
        error;

      console.log(
        `Instagram image candidate ${i + 1} failed:`,
        error?.message ||
          error
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

async function downloadInstagramPost(
  url,
  jobDirectory
) {
  const shortcode =
    extractInstagramShortcode(
      url
    );

  if (!shortcode) {
    throw new Error(
      "Instagram post shortcode could not be extracted"
    );
  }

  const media =
    await getInstagramPostGraphQL(
      shortcode,
      url
    );

  console.log(
    "Instagram GraphQL media type:",
    media?.media_type
  );

  console.log(
    "Instagram GraphQL media code:",
    media?.code
  );

  console.log(
    "Instagram GraphQL media pk:",
    media?.pk
  );

  const imageUrls =
    extractImageUrlsFromMedia(
      media
    );

  if (!imageUrls.length) {
    throw new Error(
      "Instagram GraphQL returned media but no image candidates"
    );
  }

  const filePath =
    await downloadInstagramImage(
      imageUrls,
      jobDirectory
    );

  return {
    filePath,

    contentType:
      "PHOTO",

    mediaType:
      media?.media_type ===
      8
        ? "CAROUSEL"
        : "PHOTO",

    finalCost:
      null,
  };
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
          noPlaylist:
            true,

          noWarnings:
            true,

          noCheckCertificates:
            true,

          dumpSingleJson:
            true,

          skipDownload:
            true,
        }
      );

    console.log(
      "Instagram metadata extraction completed"
    );

    return metadata;
  } catch (
    error
  ) {
    console.log(
      "Instagram metadata extraction failed:",
      error?.message ||
        error
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
    cleanInstagramUrl(
      url
    );

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
  } =
    createOutputTemplate(
      jobId
    );

  /*
   * POST
   *
   * اینجا دیگر HTML را
   * برای عکس استفاده نمی‌کنیم.
   *
   * مسیر:
   *
   * shortcode
   * ↓
   * GraphQL
   * ↓
   * image_versions2.candidates
   * ↓
   * download
   */

  if (
    normalizedContentType ===
    "POST"
  ) {
    try {
      return await downloadInstagramPost(
        normalizedUrl,
        jobDirectory
      );
    } catch (
      error
    ) {
      console.log(
        "Instagram GraphQL photo download failed:",
        error?.message ||
          error
      );

      throw error;
    }
  }

  /*
   * REEL / STORY / VIDEO
   *
   * مسیر قبلی بدون تغییر.
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

      noPlaylist:
        true,

      noWarnings:
        true,

      noCheckCertificates:
        true,
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
        fs
          .statSync(file)
          .isFile()
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

    finalCost:
      null,
  };
}

module.exports = {
  downloadInstagramMedia,
  getInstagramMetadata,
  getInstagramPostHtml,
  extractInstagramShortcode,
  detectInstagramMediaType,
  detectFileContentType,
};
