
const fs = require("fs");
const path = require("path");
const os = require("os");

process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(
  __dirname,
  "..",
  "node_modules",
  "playwright-core",
  ".local-browsers"
);

const { chromium } = require("playwright");

const DOWNLOAD_ROOT = path.join(
  os.tmpdir(),
  "zeka-instagram-downloads"
);

function ensureDownloadRoot() {
  fs.mkdirSync(DOWNLOAD_ROOT, { recursive: true });
}

function cleanUrl(url) {
  return (
    String(url || "")
      .trim()
      .replace(/[?#].*$/, "")
      .replace(/\/+$/, "") + "/"
  );
}

function getExtension(contentType) {
  const type = String(contentType || "").toLowerCase();

  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  if (type.includes("avif")) return ".avif";
  if (type.includes("gif")) return ".gif";
  if (type.includes("mp4")) return ".mp4";

  return ".jpg";
}

function normalizeMediaUrl(value) {
  if (!value) return null;

  let result = String(value)
    .replace(/&amp;/g, "&")
    .replace(/\\u0026/g, "&")
    .replace(/\\u003D/g, "=")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .trim()
    .replace(/^["']+|["']+$/g, "");

  try {
    const parsed = new URL(result);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

function isValidImageUrl(value) {
  const url = normalizeMediaUrl(value);

  if (!url) return false;

  if (/static\.cdninstagram\.com/i.test(url)) {
    return false;
  }

  if (/instagram\.com\/static/i.test(url)) {
    return false;
  }

  return (
    /scontent[^/]*\.(fbcdn|cdninstagram)/i.test(url) ||
    /fbcdn\.net/i.test(url) ||
    /cdninstagram\.com/i.test(url)
  );
}

function isValidVideoUrl(value) {
  const url = normalizeMediaUrl(value);

  if (!url) return false;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    const trustedHost =
      host.includes("fbcdn.net") ||
      host.includes("cdninstagram.com") ||
      host.includes("instagram.com");

    const looksLikeVideo =
      /\.mp4(?:$|\/)/i.test(parsed.pathname) ||
      /video|\.mp4|\/v\/|\/o1\//i.test(
        parsed.pathname + parsed.search
      );

    return trustedHost && looksLikeVideo;
  } catch {
    return false;
  }
}

async function downloadImage({
  context,
  imageUrl,
  jobDirectory,
  fileName,
}) {
  const normalizedUrl = normalizeMediaUrl(imageUrl);

  if (!normalizedUrl || !isValidImageUrl(normalizedUrl)) {
    throw new Error("Instagram image URL is invalid");
  }

  const response = await context.request.get(normalizedUrl, {
    headers: {
      Referer: "https://www.instagram.com/",
      Origin: "https://www.instagram.com",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
    timeout: 30000,
  });

  if (!response.ok()) {
    throw new Error(
      `Instagram image request failed: HTTP ${response.status()}`
    );
  }

  const contentType = (
    response.headers()["content-type"] || ""
  ).toLowerCase();

  if (!contentType.startsWith("image/")) {
    throw new Error(
      `Instagram response is not an image: ${contentType}`
    );
  }

  const buffer = await response.body();

  if (!buffer || !buffer.length) {
    throw new Error("Instagram image response is empty");
  }

  const filePath = path.join(
    jobDirectory,
    `${fileName}${getExtension(contentType)}`
  );

  fs.writeFileSync(filePath, buffer);

  return {
    filePath,
    fileSize: fs.statSync(filePath).size,
    contentType,
  };
}

async function downloadVideo({
  context,
  videoUrl,
  jobDirectory,
  fileName,
}) {
  const normalizedUrl = normalizeMediaUrl(videoUrl);

  if (!normalizedUrl || !isValidVideoUrl(normalizedUrl)) {
    throw new Error("Instagram video URL is invalid");
  }

  const response = await context.request.get(normalizedUrl, {
    headers: {
      Referer: "https://www.instagram.com/",
      Origin: "https://www.instagram.com",
      Accept: "video/mp4,video/*;q=0.9,*/*;q=0.8",
    },
    timeout: 60000,
  });

  if (!response.ok()) {
    throw new Error(
      `Instagram video request failed: HTTP ${response.status()}`
    );
  }

  const contentType = (
    response.headers()["content-type"] || ""
  ).toLowerCase();

  if (
    !contentType.startsWith("video/") &&
    !/\.mp4(?:$|[?#])/i.test(normalizedUrl)
  ) {
    throw new Error(
      `Instagram response is not a video: ${contentType}`
    );
  }

  const buffer = await response.body();

  if (!buffer || !buffer.length) {
    throw new Error("Instagram video response is empty");
  }

  const filePath = path.join(
    jobDirectory,
    `${fileName}.mp4`
  );

  fs.writeFileSync(filePath, buffer);

  return {
    filePath,
    fileSize: fs.statSync(filePath).size,
    contentType: contentType || "video/mp4",
  };
}

async function extractMediaFromPage(page) {
  return page.evaluate(() => {
    const normalize = (value) => {
      if (!value) return null;

      return String(value)
        .replace(/&amp;/g, "&")
        .replace(/\\u0026/g, "&")
        .replace(/\\u003D/g, "=")
        .replace(/\\"/g, '"')
        .replace(/\\\//g, "/")
        .trim()
        .replace(/^["']+|["']+$/g, "");
    };

    const isInstagramCdn = (value) => {
      if (!value) return false;

      return (
        /fbcdn\.net|cdninstagram\.com|scontent/i.test(value)
      );
    };

    const videos = [];

    const addVideo = (value, source) => {
      const url = normalize(value);

      if (!url || !/^https?:\/\//i.test(url)) return;
      if (!isInstagramCdn(url)) return;

      const looksLikeVideo =
        /\.mp4(?:$|[?#])/i.test(url) ||
        /video|\.mp4|\/v\/|\/o1\//i.test(url);

      if (!looksLikeVideo) return;

      if (videos.some((item) => item.url === url)) return;

      videos.push({ url, source });
    };

    document.querySelectorAll("video").forEach((video) => {
      addVideo(video.currentSrc, "video-current-src");
      addVideo(video.src, "video-src");

      video.querySelectorAll("source").forEach((source) => {
        addVideo(source.src || source.getAttribute("src"), "video-source");
      });
    });

    const videoMetaSelectors = [
      'meta[property="og:video"]',
      'meta[property="og:video:url"]',
      'meta[property="og:video:secure_url"]',
      'meta[name="twitter:player:stream"]',
    ];

    for (const selector of videoMetaSelectors) {
      const element = document.querySelector(selector);
      addVideo(element?.getAttribute("content"), "video-meta");
    }

    const resources = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name);

    for (const resource of resources) {
      addVideo(resource, "performance-resource");
    }

    const images = [];

    const addImage = (value, width = 0, height = 0, source = "") => {
      const url = normalize(value);

      if (!url || !/^https?:\/\//i.test(url)) return;
      if (!isInstagramCdn(url)) return;

      if (images.some((item) => item.url === url)) return;

      images.push({ url, width, height, source });
    };

    document.querySelectorAll("img").forEach((img) => {
      addImage(
        img.currentSrc || img.src || img.getAttribute("src"),
        Number(img.naturalWidth || img.width || 0),
        Number(img.naturalHeight || img.height || 0),
        "dom-image"
      );
    });

    const imageMetaSelectors = [
      'meta[property="og:image"]',
      'meta[property="og:image:url"]',
      'meta[name="twitter:image"]',
      'meta[name="twitter:image:src"]',
    ];

    for (const selector of imageMetaSelectors) {
      const element = document.querySelector(selector);
      addImage(element?.getAttribute("content"), 0, 0, "image-meta");
    }

    images.sort(
      (a, b) => b.width * b.height - a.width * a.height
    );

    return {
      videos,
      images,
      pageTitle: document.title || "",
      pageUrl: location.href,
    };
  });
}

async function downloadInstagramWithBrowser({
  url,
  jobId,
  contentType = "OTHER",
}) {
  ensureDownloadRoot();

  const normalizedUrl = cleanUrl(url);
  const normalizedType = String(contentType || "OTHER")
    .trim()
    .toUpperCase();

  const jobDirectory = path.join(
    DOWNLOAD_ROOT,
    String(jobId || Date.now())
  );

  fs.mkdirSync(jobDirectory, { recursive: true });

  let browser;

  try {
    console.log(
      "Instagram browser download started:",
      normalizedUrl,
      "type:",
      normalizedType
    );

    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      locale: "en-US",
      timezoneId: "UTC",
      viewport: {
        width: 1280,
        height: 720,
      },
    });

    const page = await context.newPage();

    await page.goto(normalizedUrl, {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});

if (normalizedType === "STORY") {
  const finalUrl = new URL(page.url());
  const pathParts = finalUrl.pathname
    .split("/")
    .filter(Boolean);

  if (
    pathParts[0] !== "stories" ||
    pathParts.length < 3
  ) {
    throw new Error(
      "Instagram redirected the story URL to a non-story page. Story download cancelled."
    );
  }
}

await page.waitForTimeout(5000);

    const media = await extractMediaFromPage(page);

    console.log(
      "Instagram browser video candidates:",
      media.videos.length
    );

    console.log(
      "Instagram browser image candidates:",
      media.images.length
    );

    const shouldTryVideo = [
      "STORY",
      "REEL",
      "VIDEO",
      "OTHER",
    ].includes(normalizedType);

    if (shouldTryVideo && media.videos.length) {
      let lastVideoError = null;

      for (const candidate of media.videos.slice(0, 5)) {
        try {
          console.log(
            "Trying Instagram browser video candidate:",
            candidate.source
          );

          const downloaded = await downloadVideo({
            context,
            videoUrl: candidate.url,
            jobDirectory,
            fileName: "instagram_media",
          });

          console.log(
            "Instagram browser video download completed:",
            downloaded.filePath
          );

          return {
            success: true,
            filePath: downloaded.filePath,
            fileSize: downloaded.fileSize,
            contentType: downloaded.contentType,
            sourceUrl: normalizedUrl,
            mediaType: "VIDEO",
          };
        } catch (error) {
          lastVideoError = error;

          console.error(
            "Instagram browser video candidate failed:",
            error?.message || String(error)
          );
        }
      }

      if (
        normalizedType === "REEL" ||
        normalizedType === "VIDEO"
      ) {
        throw (
          lastVideoError ||
          new Error(
            "Instagram video could not be downloaded without authentication"
          )
        );
      }
    }

    if (!media.images.length) {
      throw new Error(
        "Instagram media URL was not found. The content may require login or may be unavailable."
      );
    }

    let lastImageError = null;

    for (const candidate of media.images.slice(0, 10)) {
      try {
        const downloaded = await downloadImage({
          context,
          imageUrl: candidate.url,
          jobDirectory,
          fileName: "instagram_media",
        });

        console.log(
          "Instagram browser image download completed:",
          downloaded.filePath
        );

        return {
          success: true,
          filePath: downloaded.filePath,
          fileSize: downloaded.fileSize,
          contentType: downloaded.contentType,
          sourceUrl: normalizedUrl,
          mediaType: "PHOTO",
        };
      } catch (error) {
        lastImageError = error;

        console.error(
          "Instagram browser image candidate failed:",
          error?.message || String(error)
        );
      }
    }

    throw (
      lastImageError ||
      new Error("Instagram browser media download failed")
    );
  } catch (error) {
    console.error(
      "Instagram browser download failed:",
      error?.message || String(error)
    );

    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
  }
}

async function downloadInstagramProfile({ url, jobId }) {
  ensureDownloadRoot();

  const normalizedUrl = cleanUrl(url);

  const jobDirectory = path.join(
    DOWNLOAD_ROOT,
    `profile-${String(jobId || Date.now())}`
  );

  fs.mkdirSync(jobDirectory, { recursive: true });

  let browser;

  try {
    console.log(
      "Instagram profile download started:",
      normalizedUrl
    );

    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      locale: "en-US",
      timezoneId: "UTC",
      viewport: {
        width: 1280,
        height: 720,
      },
    });

    const page = await context.newPage();

    await page.goto(normalizedUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(5000);

    const profileData = await page.evaluate(() => {
      const normalize = (value) => {
        if (!value) return null;

        return String(value)
          .replace(/&amp;/g, "&")
          .replace(/\\u0026/g, "&")
          .replace(/\\u003D/g, "=")
          .replace(/\\"/g, '"')
          .replace(/\\\//g, "/")
          .trim()
          .replace(/^["']+|["']+$/g, "");
      };

      const isRealInstagramImage = (value) => {
        if (!value) return false;

        const normalized = normalize(value);

        if (!normalized || !/^https?:\/\//i.test(normalized)) {
          return false;
        }

        if (/static\.cdninstagram\.com/i.test(normalized)) {
          return false;
        }

        if (/instagram\.com\/static/i.test(normalized)) {
          return false;
        }

        return (
          /scontent[^/]*\.(fbcdn|cdninstagram)/i.test(normalized) ||
          /fbcdn\.net/i.test(normalized) ||
          /cdninstagram\.com/i.test(normalized)
        );
      };

      const candidates = [];
      const addCandidate = (value, method, score = 0) => {
        const normalized = normalize(value);

        if (!isRealInstagramImage(normalized)) return;
        if (candidates.some((item) => item.url === normalized)) return;

        candidates.push({ url: normalized, method, score });
      };

      const extractFromText = (text) => {
        if (!text) return [];

        const source = String(text);
        const found = new Set();

        const patterns = [
          /"profile_pic_url_hd"\s*:\s*"([^"]+)"/gi,
          /"profile_pic_url"\s*:\s*"([^"]+)"/gi,
          /"profile_picture_url"\s*:\s*"([^"]+)"/gi,
          /"profile_image_url"\s*:\s*"([^"]+)"/gi,
          /profile_pic_url_hd\\?"?\s*:\s*\\?"([^"]+)/gi,
          /profile_pic_url\\?"?\s*:\s*\\?"([^"]+)/gi,
          /https?:\\?\/\\?\/[^"'\\\s]+(?:fbcdn|cdninstagram)[^"'\\\s]*/gi,
        ];

        for (const pattern of patterns) {
          let match;

          while ((match = pattern.exec(source)) !== null) {
            const raw = match[1] || match[0];
            const value = normalize(raw);

            if (isRealInstagramImage(value)) {
              found.add(value);
            }
          }
        }

        return Array.from(found);
      };

      const scripts = Array.from(
        document.querySelectorAll("script")
      );

      for (const script of scripts) {
        const text = script.textContent || "";
        const urls = extractFromText(text);

        for (const imageUrl of urls) {
          let score = 50;

          if (/profile_pic_url_hd/i.test(text)) {
            score = 100;
          } else if (/profile_pic_url/i.test(text)) {
            score = 90;
          }

          addCandidate(imageUrl, "script-profile-data", score);
        }
      }

      const html = document.documentElement?.outerHTML || "";

      for (const imageUrl of extractFromText(html)) {
        addCandidate(imageUrl, "html-profile-data", 80);
      }

      const metaSelectors = [
        'meta[property="og:image"]',
        'meta[property="og:image:url"]',
        'meta[name="twitter:image"]',
        'meta[name="twitter:image:src"]',
      ];

      for (const selector of metaSelectors) {
        const element = document.querySelector(selector);

        addCandidate(
          element?.getAttribute("content"),
          "meta",
          70
        );
      }

      const images = Array.from(
        document.querySelectorAll("img")
      );

      for (const img of images) {
        const src =
          img.currentSrc ||
          img.src ||
          img.getAttribute("src");

        const alt = img.getAttribute("alt") || "";

        let score = 20;

        if (/profile picture|profile photo|profile image/i.test(alt)) {
          score = 95;
        }

        const width = Number(img.naturalWidth || img.width || 0);
        const height = Number(img.naturalHeight || img.height || 0);

        if (width >= 150 && height >= 150) {
          score += 10;
        }

        addCandidate(src, "dom-image", score);
      }

      candidates.sort((a, b) => b.score - a.score);

      return {
        candidates,
        scriptCount: scripts.length,
        imageCount: images.length,
      };
    });

    console.log(
      "Instagram profile candidate count:",
      profileData?.candidates?.length || 0
    );

    if (!profileData?.candidates?.length) {
      throw new Error(
        "Instagram profile picture URL was not found"
      );
    }

    let lastError = null;

    for (const candidate of profileData.candidates) {
      try {
        console.log(
          `Trying Instagram profile candidate (${candidate.method}, score ${candidate.score})`
        );

        const downloaded = await downloadImage({
          context,
          imageUrl: candidate.url,
          jobDirectory,
          fileName: "instagram_profile",
        });

        console.log(
          "Instagram profile picture download completed:",
          downloaded.filePath
        );

        return {
          success: true,
          filePath: downloaded.filePath,
          fileSize: downloaded.fileSize,
          contentType: downloaded.contentType,
          sourceUrl: normalizedUrl,
          mediaType: "PROFILE",
        };
      } catch (error) {
        lastError = error;

        console.error(
          "Instagram profile candidate failed:",
          error?.message || String(error)
        );
      }
    }

    throw (
      lastError ||
      new Error("Instagram profile picture download failed")
    );
  } catch (error) {
    console.error(
      "Instagram profile download failed:",
      error?.message || String(error)
    );

    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
  }
}

module.exports = {
  downloadInstagramWithBrowser,
  downloadInstagramProfile,
};
