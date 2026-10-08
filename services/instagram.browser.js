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
  fs.mkdirSync(DOWNLOAD_ROOT, {
    recursive: true,
  });
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

function isValidImageUrl(value) {
  if (!value) {
    return false;
  }

  const url = String(value)
    .replace(/&amp;/g, "&")
    .replace(/\\u0026/g, "&")
    .replace(/\\u003D/g, "=")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .trim();

  if (!/^https?:\/\//i.test(url)) {
    return false;
  }

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

function normalizeImageUrl(value) {
  if (!value) {
    return null;
  }

  let result = String(value)
    .replace(/&amp;/g, "&")
    .replace(/\\u0026/g, "&")
    .replace(/\\u003D/g, "=")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .trim();

  result = result.replace(/^["']+|["']+$/g, "");

  return isValidImageUrl(result) ? result : null;
}

function extractImageUrlsFromText(text) {
  if (!text) {
    return [];
  }

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

      const normalized = normalizeImageUrl(raw);

      if (normalized) {
        found.add(normalized);
      }
    }
  }

  return Array.from(found);
}

async function downloadImage({
  context,
  imageUrl,
  jobDirectory,
  fileName,
}) {
  const response = await context.request.get(
    imageUrl,
    {
      headers: {
        Referer: "https://www.instagram.com/",
        Origin: "https://www.instagram.com",
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      timeout: 30000,
    }
  );

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
      `Instagram image response is not an image: ${contentType}`
    );
  }

  const buffer = await response.body();

  if (!buffer || !buffer.length) {
    throw new Error(
      "Instagram image response is empty"
    );
  }

  const extension = getExtension(contentType);

  const filePath = path.join(
    jobDirectory,
    `${fileName}${extension}`
  );

  fs.writeFileSync(
    filePath,
    buffer
  );

  const fileSize = fs.statSync(
    filePath
  ).size;

  return {
    filePath,
    fileSize,
    contentType,
  };
}

async function downloadInstagramWithBrowser({
  url,
  jobId,
}) {
  ensureDownloadRoot();

  const normalizedUrl = cleanUrl(url);

  const jobDirectory = path.join(
    DOWNLOAD_ROOT,
    String(jobId || Date.now())
  );

  fs.mkdirSync(
    jobDirectory,
    {
      recursive: true,
    }
  );

  let browser;

  try {
    console.log(
      `Instagram browser download started: ${normalizedUrl}`
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

    await page.goto(
      normalizedUrl,
      {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      }
    );

    await page.waitForTimeout(4000);

    const media = await page.evaluate(() => {
      const images = Array.from(
        document.querySelectorAll("img")
      );

      const candidates = images
        .map((img) => ({
          src:
            img.currentSrc ||
            img.src ||
            img.getAttribute("src"),
          width: Number(
            img.naturalWidth ||
              img.width ||
              0
          ),
          height: Number(
            img.naturalHeight ||
              img.height ||
              0
          ),
          alt:
            img.getAttribute("alt") || "",
        }))
        .filter((item) => item.src);

      const preferred = candidates
        .filter((item) =>
          /cdninstagram\.com|fbcdn\.net|scontent/i.test(
            item.src
          )
        )
        .sort(
          (a, b) =>
            b.width * b.height -
            a.width * a.height
        );

      return (
        preferred[0] ||
        candidates.sort(
          (a, b) =>
            b.width * b.height -
            a.width * a.height
        )[0] ||
        null
      );
    });

    if (!media?.src) {
      throw new Error(
        "Instagram media URL was not found"
      );
    }

    const downloaded = await downloadImage({
      context,
      imageUrl: media.src,
      jobDirectory,
      fileName: "instagram_media",
    });

    console.log(
      "Instagram browser download completed:",
      downloaded.filePath
    );

    return {
      success: true,
      filePath: downloaded.filePath,
      fileSize: downloaded.fileSize,
      contentType: downloaded.contentType,
      sourceUrl: normalizedUrl,
    };
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

async function downloadInstagramProfile({
  url,
  jobId,
}) {
  ensureDownloadRoot();

  const normalizedUrl = cleanUrl(url);

  const jobDirectory = path.join(
    DOWNLOAD_ROOT,
    `profile-${String(
      jobId || Date.now()
    )}`
  );

  fs.mkdirSync(
    jobDirectory,
    {
      recursive: true,
    }
  );

  let browser;

  try {
    console.log(
      `Instagram profile download started: ${normalizedUrl}`
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

    await page.goto(
      normalizedUrl,
      {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      }
    );

    await page.waitForTimeout(5000);

    const username = new URL(normalizedUrl).pathname
  .split("/")
  .filter(Boolean)[0];

const apiUrl =
  `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;

const apiResponse = await fetch(apiUrl, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
    "X-IG-App-ID": "936619743392459",
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "*/*",
    "Referer": `https://www.instagram.com/${username}/`,
  },
});

const apiBody = await apiResponse.text();

    console.log(
  "Instagram profile API FULL RESPONSE:",
  apiBody
);

console.log(
  "Instagram profile API TEST:",
  apiResponse.status,
  apiBody.slice(0, 1000)
);

    console.log(
  "Instagram profile final URL:",
  page.url()
);

console.log(
  "Instagram profile page title:",
  await page.title()
);

console.log(
  "Instagram profile body text:",
  (
    await page.locator("body").innerText().catch(() => "")
  )
    .replace(/\s+/g, " ")
    .slice(0, 1000)
);

console.log(
  "Instagram profile HTML length:",
  (
    await page.content()
  ).length
);

    const profileData = await page.evaluate(() => {
      const normalize = (value) => {
        if (!value) {
          return null;
        }

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
        if (!value) {
          return false;
        }

        const normalized = normalize(value);

        if (!normalized) {
          return false;
        }

        if (
          !/^https?:\/\//i.test(
            normalized
          )
        ) {
          return false;
        }

        if (
          /static\.cdninstagram\.com/i.test(
            normalized
          )
        ) {
          return false;
        }

        if (
          /instagram\.com\/static/i.test(
            normalized
          )
        ) {
          return false;
        }

        return (
          /scontent[^/]*\.(fbcdn|cdninstagram)/i.test(
            normalized
          ) ||
          /fbcdn\.net/i.test(
            normalized
          ) ||
          /cdninstagram\.com/i.test(
            normalized
          )
        );
      };

      const extractFromText = (text) => {
        if (!text) {
          return [];
        }

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

          while (
            (match = pattern.exec(source)) !== null
          ) {
            const raw =
              match[1] ||
              match[0];

            const value =
              normalize(raw);

            if (
              isRealInstagramImage(
                value
              )
            ) {
              found.add(value);
            }
          }
        }

        return Array.from(found);
      };

      const candidates = [];

      const addCandidate = (
        value,
        method,
        score = 0
      ) => {
        const normalized =
          normalize(value);

        if (
          !isRealInstagramImage(
            normalized
          )
        ) {
          return;
        }

        if (
          candidates.some(
            (item) =>
              item.url ===
              normalized
          )
        ) {
          return;
        }

        candidates.push({
          url: normalized,
          method,
          score,
        });
      };

      const scripts = Array.from(
        document.querySelectorAll(
          "script"
        )
      );

      for (const script of scripts) {
        const text =
          script.textContent || "";

        const urls =
          extractFromText(text);

        for (const imageUrl of urls) {
          let score = 50;

          if (
            /profile_pic_url_hd/i.test(
              text
            )
          ) {
            score = 100;
          } else if (
            /profile_pic_url/i.test(
              text
            )
          ) {
            score = 90;
          }

          addCandidate(
            imageUrl,
            "script-profile-data",
            score
          );
        }
      }

      const html =
        document.documentElement?.outerHTML ||
        "";

      const htmlUrls =
        extractFromText(html);

      for (const imageUrl of htmlUrls) {
        addCandidate(
          imageUrl,
          "html-profile-data",
          80
        );
      }

      const metaSelectors = [
        'meta[property="og:image"]',
        'meta[property="og:image:url"]',
        'meta[name="twitter:image"]',
        'meta[name="twitter:image:src"]',
      ];

      for (const selector of metaSelectors) {
        const element =
          document.querySelector(
            selector
          );

        const value =
          element?.getAttribute(
            "content"
          );

        addCandidate(
          value,
          "meta",
          70
        );
      }

      const images = Array.from(
        document.querySelectorAll(
          "img"
        )
      );

      for (const img of images) {
        const src =
          img.currentSrc ||
          img.src ||
          img.getAttribute("src");

        const alt =
          img.getAttribute("alt") ||
          "";

        let score = 20;

        if (
          /profile picture|profile photo|profile image/i.test(
            alt
          )
        ) {
          score = 95;
        }

        const width = Number(
          img.naturalWidth ||
            img.width ||
            0
        );

        const height = Number(
          img.naturalHeight ||
            img.height ||
            0
        );

        if (
          width >= 150 &&
          height >= 150
        ) {
          score += 10;
        }

        addCandidate(
          src,
          "dom-image",
          score
        );
      }

      candidates.sort(
        (a, b) =>
          b.score - a.score
      );

      return {
        candidates,
        scriptCount: scripts.length,
        imageCount: images.length,
      };
    });

    console.log(
      "Instagram profile script count:",
      profileData?.scriptCount || 0
    );

    console.log(
      "Instagram profile DOM image count:",
      profileData?.imageCount || 0
    );

    console.log(
      "Instagram profile candidate count:",
      profileData?.candidates?.length || 0
    );

    if (
      profileData?.candidates?.length
    ) {
      console.log(
        "Instagram profile candidate methods:",
        profileData.candidates
          .slice(0, 10)
          .map(
            (item) =>
              `${item.method}:${item.score}`
          )
          .join(", ")
      );
    }

    if (
      !profileData?.candidates?.length
    ) {
      throw new Error(
        "Instagram profile picture URL was not found"
      );
    }

    let lastError = null;

    for (
      const candidate of
        profileData.candidates
    ) {
      try {
        console.log(
          `Trying Instagram profile candidate (${candidate.method}, score ${candidate.score}):`,
          candidate.url.slice(
            0,
            220
          )
        );

        const downloaded =
          await downloadImage({
            context,
            imageUrl:
              candidate.url,
            jobDirectory,
            fileName:
              "instagram_profile",
          });

        console.log(
          "Instagram profile picture download completed:",
          downloaded.filePath
        );

        return {
          success: true,
          filePath:
            downloaded.filePath,
          fileSize:
            downloaded.fileSize,
          contentType:
            downloaded.contentType,
          sourceUrl:
            normalizedUrl,
          mediaType:
            "PROFILE",
        };
      } catch (error) {
        lastError = error;

        console.error(
          `Instagram profile candidate failed (${candidate.method}):`,
          error?.message ||
            String(error)
        );
      }
    }

    throw (
      lastError ||
      new Error(
        "Instagram profile picture download failed"
      )
    );
  } catch (error) {
    console.error(
      "Instagram profile download failed:",
      error?.message ||
        String(error)
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
