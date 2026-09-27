const fs = require("fs");
const path = require("path");
const os = require("os");

const { chromium } = require("playwright");

const DOWNLOAD_ROOT = path.join(
  os.tmpdir(),
  "zeka-instagram-browser"
);

function ensureDownloadRoot() {
  fs.mkdirSync(DOWNLOAD_ROOT, {
    recursive: true,
  });
}

function cleanUrl(url) {
  if (!url) {
    throw new Error("Instagram URL is required");
  }

  const parsed = new URL(url);

  parsed.search = "";
  parsed.hash = "";

  return parsed.toString();
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
      ],
    });

    const context = await browser.newContext({
      viewport: {
        width: 1280,
        height: 720,
      },

      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",

      locale: "en-US",

      timezoneId: "UTC",

      acceptDownloads: true,
    });

    const page = await context.newPage();

    page.setDefaultTimeout(30000);

    const mediaUrls = new Set();

    page.on("response", async (response) => {
      try {
        const responseUrl = response.url();

        const contentType =
          response.headers()["content-type"] || "";

        if (
          contentType.startsWith("video/") ||
          contentType.startsWith("image/")
        ) {
          mediaUrls.add(responseUrl);

          console.log(
            `Instagram browser media detected: ${responseUrl.slice(
              0,
              180
            )}`
          );
        }
      } catch (error) {
        console.log(
          "Instagram browser response inspection failed:",
          error?.message || String(error)
        );
      }
    });

    await page.goto(normalizedUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(5000);

    const finalUrl = page.url();

    console.log(
      `Instagram browser final URL: ${finalUrl}`
    );

    const title = await page.title().catch(() => "");

    console.log(
      `Instagram browser page title: ${title}`
    );

    const html = await page.content();

    const videoMatches =
      html.match(
        /https?:\/\/[^"'\\ ]+(?:\.mp4|video)[^"'\\ ]*/gi
      ) || [];

    for (const mediaUrl of videoMatches) {
      try {
        mediaUrls.add(
          mediaUrl
            .replace(/\\u0026/g, "&")
            .replace(/\\u003D/g, "=")
        );
      } catch {
        // Ignore malformed media URLs.
      }
    }

    if (!mediaUrls.size) {
      throw new Error(
        "Instagram browser could not detect media"
      );
    }

    const selectedUrl =
      [...mediaUrls].find((mediaUrl) =>
        mediaUrl.includes(".mp4")
      ) ||
      [...mediaUrls][0];

    console.log(
      `Instagram browser selected media: ${selectedUrl.slice(
        0,
        200
      )}`
    );

    const mediaResponse =
      await context.request.get(selectedUrl, {
        timeout: 60000,
      });

    if (!mediaResponse.ok()) {
      throw new Error(
        `Instagram browser media request failed: HTTP ${mediaResponse.status()}`
      );
    }

    const buffer =
      await mediaResponse.body();

    if (!buffer || !buffer.length) {
      throw new Error(
        "Instagram browser received an empty media file"
      );
    }

    const extension =
      selectedUrl.includes(".mp4") ||
      (mediaResponse.headers()["content-type"] || "").includes(
        "video"
      )
        ? ".mp4"
        : ".jpg";

    const filePath = path.join(
      jobDirectory,
      `instagram${extension}`
    );

    fs.writeFileSync(
      filePath,
      buffer
    );

    const fileSize =
      fs.statSync(filePath).size;

    if (!fileSize) {
      throw new Error(
        "Instagram browser created an empty file"
      );
    }

    console.log(
      `Instagram browser download completed: ${filePath}`
    );

    return {
      success: true,
      filePath,
      fileSize,
      sourceUrl: normalizedUrl,
      mediaUrl: selectedUrl,
    };
  } catch (error) {
    console.error(
      "Instagram browser download failed:",
      error?.message || String(error)
    );

    throw error;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

module.exports = {
  downloadInstagramWithBrowser,
};
