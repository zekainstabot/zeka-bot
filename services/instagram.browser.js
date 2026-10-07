const fs = require("fs");
const path = require("path");
const os = require("os");
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
  return String(url || "")
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "") + "/";
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
          width:
            Number(img.naturalWidth || img.width || 0),
          height:
            Number(img.naturalHeight || img.height || 0),
          alt:
            img.getAttribute("alt") || "",
        }))
        .filter((item) => item.src);

      const preferred = candidates.find((item) =>
        /cdninstagram\.com|fbcdn\.net|scontent/i.test(
          item.src
        )
      );

      return preferred || candidates[0] || null;
    });

    if (!media?.src) {
      throw new Error(
        "Instagram media URL was not found"
      );
    }

    const response = await context.request.get(
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
        response.headers()["content-type"] ||
        ""
      ).toLowerCase();

    const buffer = await response.body();

    if (
      !buffer ||
      !buffer.length
    ) {
      throw new Error(
        "Instagram media is empty"
      );
    }

    let extension = ".jpg";

    if (contentType.includes("png")) {
      extension = ".png";
    } else if (
      contentType.includes("webp")
    ) {
      extension = ".webp";
    } else if (
      contentType.includes("gif")
    ) {
      extension = ".gif";
    } else if (
      contentType.includes("avif")
    ) {
      extension = ".avif";
    } else if (
      contentType.includes("mp4")
    ) {
      extension = ".mp4";
    }

    const filePath = path.join(
      jobDirectory,
      `instagram_media${extension}`
    );

    fs.writeFileSync(
      filePath,
      buffer
    );

    const fileSize = fs.statSync(
      filePath
    ).size;

    console.log(
      "Instagram browser download completed:",
      filePath
    );

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

  try {
    console.log(
      `Instagram profile download started: ${normalizedUrl}`
    );

    const pageResponse = await fetch(
      normalizedUrl,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language":
            "en-US,en;q=0.9",
        },
        redirect: "follow",
      }
    );

    if (!pageResponse.ok) {
      throw new Error(
        `Instagram profile page request failed: HTTP ${pageResponse.status}`
      );
    }

    const html =
      await pageResponse.text();

    const ogImageMatch =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i
      );

    let imageUrl =
      ogImageMatch?.[1] || null;

    if (imageUrl) {
      imageUrl =
        imageUrl
          .replace(/&amp;/g, "&")
          .replace(/\\u0026/g, "&")
          .replace(/\\u003D/g, "=");
    }

    if (!imageUrl) {
      throw new Error(
        "Instagram profile picture URL was not found"
      );
    }

    console.log(
      "Instagram profile picture detected:",
      imageUrl.slice(0, 180)
    );

    const response =
      await fetch(
        imageUrl,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            Referer:
              "https://www.instagram.com/",
            Accept:
              "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          },
          redirect: "follow",
        }
      );

    if (!response.ok) {
      throw new Error(
        `Instagram profile picture request failed: HTTP ${response.status}`
      );
    }

    const contentType =
      (
        response.headers.get(
          "content-type"
        ) || ""
      ).toLowerCase();

    if (
      !contentType.startsWith(
        "image/"
      )
    ) {
      throw new Error(
        "Instagram profile response is not an image"
      );
    }

    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    if (
      !buffer ||
      !buffer.length
    ) {
      throw new Error(
        "Instagram profile picture is empty"
      );
    }

    let extension =
      ".jpg";

    if (
      contentType.includes(
        "png"
      )
    ) {
      extension = ".png";
    } else if (
      contentType.includes(
        "webp"
      )
    ) {
      extension = ".webp";
    } else if (
      contentType.includes(
        "avif"
      )
    ) {
      extension = ".avif";
    }

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

    return {
      success: true,
      filePath,
      fileSize,
      sourceUrl:
        normalizedUrl,
      mediaType:
        "PROFILE",
    };
  } catch (error) {
    console.error(
      "Instagram profile download failed:",
      error?.message ||
        String(error)
    );

    throw error;
  }
}

module.exports = {
  downloadInstagramWithBrowser,
  downloadInstagramProfile,
};
