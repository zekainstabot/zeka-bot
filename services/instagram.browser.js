async function downloadInstagramProfile({
  url,
  jobId,
}) {
  ensureDownloadRoot();

  const normalizedUrl = cleanUrl(url);

  const jobDirectory = path.join(
    DOWNLOAD_ROOT,
    `profile-${String(jobId || Date.now())}`
  );

  fs.mkdirSync(jobDirectory, {
    recursive: true,
  });

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

    await page.goto(normalizedUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(5000);

    const imageUrl = await page.evaluate(() => {
      const normalize = (value) => {
        if (!value) return null;

        return String(value)
          .replace(/&amp;/g, "&")
          .replace(/\\u0026/g, "&")
          .replace(/\\u003D/g, "=")
          .trim();
      };

      const metaSelectors = [
        'meta[property="og:image"]',
        'meta[property="og:image:url"]',
        'meta[name="twitter:image"]',
        'meta[name="twitter:image:src"]',
      ];

      for (const selector of metaSelectors) {
        const element =
          document.querySelector(selector);

        const content =
          element?.getAttribute("content");

        if (content) {
          return normalize(content);
        }
      }

      const images = Array.from(
        document.querySelectorAll("img")
      );

      const imageCandidates = images
        .map((img) => ({
          src:
            img.currentSrc ||
            img.src ||
            img.getAttribute("src"),
          alt:
            img.getAttribute("alt") || "",
          width:
            Number(img.naturalWidth || img.width || 0),
          height:
            Number(img.naturalHeight || img.height || 0),
        }))
        .filter(
          (item) =>
            item.src &&
            /^https?:\/\//i.test(item.src)
        );

      const preferred = imageCandidates
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

      if (preferred.length) {
        return normalize(preferred[0].src);
      }

      const squareImages =
        imageCandidates
          .filter(
            (item) =>
              item.width > 100 &&
              item.height > 100 &&
              Math.abs(
                item.width - item.height
              ) <
                Math.max(
                  item.width,
                  item.height
                ) *
                  0.15
          )
          .sort(
            (a, b) =>
              b.width * b.height -
              a.width * a.height
          );

      if (squareImages.length) {
        return normalize(
          squareImages[0].src
        );
      }

      return null;
    });

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
      await context.request.get(
        imageUrl,
        {
          headers: {
            Referer:
              "https://www.instagram.com/",
            Accept:
              "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          },
        }
      );

    if (!response.ok()) {
      throw new Error(
        `Instagram profile picture request failed: HTTP ${response.status()}`
      );
    }

    const contentType =
      (
        response.headers()[
          "content-type"
        ] || ""
      ).toLowerCase();

    if (
      !contentType.startsWith("image/")
    ) {
      throw new Error(
        "Instagram profile response is not an image"
      );
    }

    const buffer =
      await response.body();

    if (
      !buffer ||
      !buffer.length
    ) {
      throw new Error(
        "Instagram profile picture is empty"
      );
    }

    let extension = ".jpg";

    if (
      contentType.includes("png")
    ) {
      extension = ".png";
    } else if (
      contentType.includes("webp")
    ) {
      extension = ".webp";
    } else if (
      contentType.includes("avif")
    ) {
      extension = ".avif";
    } else if (
      contentType.includes("gif")
    ) {
      extension = ".gif";
    }

    const filePath = path.join(
      jobDirectory,
      `instagram_profile${extension}`
    );

    fs.writeFileSync(
      filePath,
      buffer
    );

    const fileSize =
      fs.statSync(filePath).size;

    console.log(
      "Instagram profile picture download completed:",
      filePath
    );

    return {
      success: true,
      filePath,
      fileSize,
      contentType,
      sourceUrl: normalizedUrl,
      mediaType: "PROFILE",
    };
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
