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

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    if (
      hostname.includes("static.cdninstagram.com") ||
      hostname.includes("instagram.com")
    ) {
      return false;
    }

    return (
      hostname.includes("cdninstagram.com") ||
      hostname.includes("fbcdn.net") ||
      hostname.includes("scontent")
    );
  } catch {
    return false;
  }
}

function normalizeImageUrl(value) {
  if (!value) {
    return null;
  }

  let result = String(value)
    .replace(/&amp;/g, "&")
    .replace(/\\u0026/g, "&")
    .replace(/\\u003D/g, "=")
    .replace(/\\u002F/g, "/")
    .trim();

  if (
    result.startsWith('"') &&
    result.endsWith('"')
  ) {
    result = result.slice(1, -1);
  }

  if (!/^https?:\/\//i.test(result)) {
    return null;
  }

  return isValidImageUrl(result)
    ? result
    : null;
}

function collectImageUrlsFromText(text) {
  const urls = new Set();

  if (!text) {
    return [];
  }

  const normalizedText = String(text)
    .replace(/\\u0026/g, "&")
    .replace(/\\u003D/g, "=")
    .replace(/\\u002F/g, "/")
    .replace(/&amp;/g, "&");

  const matches = normalizedText.match(
    /https?:\\?\/\\?\/[^"'\\\s<>]+/g
  );

  if (!matches) {
    return [];
  }

  for (const raw of matches) {
    const cleaned = raw
      .replace(/\\\//g, "/")
      .replace(/\\u0026/g, "&")
      .replace(/\\u003D/g, "=")
      .replace(/&amp;/g, "&")
      .replace(/[\\"]+$/g, "");

    const url = normalizeImageUrl(cleaned);

    if (url) {
      urls.add(url);
    }
  }

  return [...urls];
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

  fs.mkdirSync(jobDirectory, {
    recursive: true,
  });

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

    await page.goto(normalizedUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

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

    const response =
      await context.request.get(
        media.src,
        {
          headers: {
            Referer:
              "https://www.instagram.com/",
          },
        }
      );

    if (!response.ok()) {
      throw new Error(
        `Instagram media request failed: HTTP ${response.status()}`
      );
    }

    const contentType =
      (
        response.headers()[
          "content-type"
        ] || ""
      ).toLowerCase();

    const buffer =
      await response.body();

    if (
      !buffer ||
      !buffer.length
    ) {
      throw new Error(
        "Instagram media is empty"
      );
    }

    const extension =
      getExtension(contentType);

    const filePath = path.join(
      jobDirectory,
      `instagram_media${extension}`
    );

    fs.writeFileSync(
      filePath,
      buffer
    );

    const fileSize =
      fs.statSync(filePath).size;

    return {
      success: true,
      filePath,
      fileSize,
      contentType,
      sourceUrl: normalizedUrl,
    };
  } catch (error) {
    console.error(
      "Instagram browser download failed:",
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

async function findProfileImageWithPage(page) {
  const result =
    await page.evaluate(() => {
      const urls = new Set();

      const add = (value) => {
        if (!value) {
          return;
        }

        const text = String(value)
          .replace(/&amp;/g, "&")
          .replace(/\\u0026/g, "&")
          .replace(/\\u003D/g, "=")
          .replace(/\\u002F/g, "/")
          .replace(/\\\//g, "/")
          .trim();

        if (
          /^https?:\/\//i.test(text) &&
          (
            /cdninstagram\.com/i.test(text) ||
            /fbcdn\.net/i.test(text) ||
            /scontent/i.test(text)
          ) &&
          !/static\.cdninstagram\.com/i.test(text)
        ) {
          urls.add(text);
        }
      };

      const images = Array.from(
        document.querySelectorAll("img")
      );

      for (const img of images) {
        add(img.currentSrc);
        add(img.src);
        add(
          img.getAttribute("src")
        );

        const srcset =
          img.getAttribute(
            "srcset"
          );

        if (srcset) {
          for (
            const part of srcset.split(",")
          ) {
            add(
              part
                .trim()
                .split(/\s+/)[0]
            );
          }
        }

        const alt =
          (
            img.getAttribute(
              "alt"
            ) || ""
          ).toLowerCase();

        if (
          alt.includes(
            "profile"
          ) ||
          alt.includes(
            "پروفایل"
          ) ||
          alt.includes(
            "عکس"
          )
        ) {
          add(img.currentSrc);
          add(img.src);
        }
      }

      const metaSelectors = [
        'meta[property="og:image"]',
        'meta[property="og:image:url"]',
        'meta[name="twitter:image"]',
        'meta[name="twitter:image:src"]',
      ];

      for (
        const selector of metaSelectors
      ) {
        const element =
          document.querySelector(
            selector
          );

        add(
          element?.getAttribute(
            "content"
          )
        );
      }

      const scripts =
        Array.from(
          document.querySelectorAll(
            "script"
          )
        );

      for (const script of scripts) {
        const text =
          script.textContent || "";

        const matches =
          text.match(
            /https?:\\?\/\\?\/[^"'\\\s<>]+/g
          );

        if (!matches) {
          continue;
        }

        for (const match of matches) {
          add(match);
        }
      }

      const ranked = [
        ...urls,
      ];

      return ranked;
    });

  return Array.isArray(result)
    ? result
    : [];
}

async function findProfileImageFromResponses(
  responses
) {
  const urls = new Set();

  for (const response of responses) {
    try {
      const contentType =
        (
          response.headers()[
            "content-type"
          ] || ""
        ).toLowerCase();

      if (
        contentType.startsWith(
          "image/"
        )
      ) {
        const url =
          response.url();

        if (
          isValidImageUrl(url)
        ) {
          urls.add(url);
        }

        continue;
      }

      if (
        contentType.includes(
          "json"
        ) ||
        contentType.includes(
          "javascript"
        ) ||
        contentType.includes(
          "text"
        )
      ) {
        const text =
          await response.text();

        for (
          const url of
            collectImageUrlsFromText(
              text
            )
        ) {
          urls.add(url);
        }
      }
    } catch {
      continue;
    }
  }

  return [
    ...urls,
  ];
}

async function downloadInstagramProfile({
  url,
  jobId,
}) {
  ensureDownloadRoot();

  const normalizedUrl =
    cleanUrl(url);

  const jobDirectory =
    path.join(
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

    const context =
      await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        locale: "en-US",
        timezoneId: "UTC",
        viewport: {
          width: 1280,
          height: 720,
        },
      });

    const capturedResponses = [];

    const responseListener =
      (response) => {
        const responseUrl =
          response.url();

        if (
          /cdninstagram\.com|fbcdn\.net|scontent|graphql/i.test(
            responseUrl
          )
        ) {
          capturedResponses.push(
            response
          );
        }
      };

    pageResponseSetup:
    {
      // Intentionally empty label scope.
    }

    const page =
      await context.newPage();

    page.on(
      "response",
      responseListener
    );

    await page.goto(
      normalizedUrl,
      {
        waitUntil:
          "domcontentloaded",
        timeout: 30000,
      }
    );

    await page.waitForTimeout(
      3000
    );

    let imageUrls =
      await findProfileImageWithPage(
        page
      );

    console.log(
      "Instagram profile DOM image candidates:",
      imageUrls.length
    );

    if (
      imageUrls.length === 0
    ) {
      await page.waitForTimeout(
        3000
      );

      imageUrls =
        await findProfileImageWithPage(
          page
        );
    }

    const responseUrls =
      await findProfileImageFromResponses(
        capturedResponses
      );

    for (
      const responseUrl of
        responseUrls
    ) {
      if (
        !imageUrls.includes(
          responseUrl
        )
      ) {
        imageUrls.push(
          responseUrl
        );
      }
    }

    console.log(
      "Instagram profile total image candidates:",
      imageUrls.length
    );

    if (
      !imageUrls.length
    ) {
      throw new Error(
        "Instagram profile picture URL was not found"
      );
    }

    let downloaded = false;
    let lastError = null;

    for (
      let i = 0;
      i < Math.min(
        imageUrls.length,
        20
      );
      i++
    ) {
      const imageUrl =
        imageUrls[i];

      try {
        console.log(
          `Instagram profile candidate ${i + 1}/${Math.min(
            imageUrls.length,
            20
          )}:`,
          imageUrl.slice(
            0,
            180
          )
        );

        const response =
          await context.request.get(
            imageUrl,
            {
              headers: {
                Referer:
                  normalizedUrl,
                Accept:
                  "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
              },
              timeout: 20000,
            }
          );

        if (
          !response.ok()
        ) {
          throw new Error(
            `HTTP ${response.status()}`
          );
        }

        const contentType =
          (
            response.headers()[
              "content-type"
            ] || ""
          ).toLowerCase();

        if (
          !contentType.startsWith(
            "image/"
          )
        ) {
          throw new Error(
            `Invalid content type: ${contentType}`
          );
        }

        const buffer =
          await response.body();

        if (
          !buffer ||
          !buffer.length
        ) {
          throw new Error(
            "Image is empty"
          );
        }

        const extension =
          getExtension(
            contentType
          );

        const filePath =
          path.join(
            jobDirectory,
            `instagram_profile${extension}`
          );

        fs.writeFileSync(
          filePath,
          buffer
        );

        const fileSize =
          fs.statSync(
            filePath
          ).size;

        console.log(
          "Instagram profile picture download completed:",
          filePath
        );

        downloaded = true;

        return {
          success: true,
          filePath,
          fileSize,
          contentType,
          sourceUrl:
            normalizedUrl,
          mediaType:
            "PROFILE",
        };
      } catch (error) {
        lastError =
          error;

        console.log(
          `Instagram profile candidate ${i + 1} failed:`,
          error?.message ||
            String(error)
        );
      }
    }

    if (!downloaded) {
      throw new Error(
        `Instagram profile picture download failed: ${
          lastError?.message ||
          "no usable image"
        }`
      );
    }
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
