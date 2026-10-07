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

    const page =
      await context.newPage();

    await page.goto(
      normalizedUrl,
      {
        waitUntil:
          "domcontentloaded",
        timeout: 30000,
      }
    );

    await page.waitForTimeout(
      5000
    );

    const profileData =
      await page.evaluate(() => {
        const normalize = (value) => {
          if (!value) {
            return null;
          }

          return String(value)
            .replace(
              /&amp;/g,
              "&"
            )
            .replace(
              /\\u0026/g,
              "&"
            )
            .replace(
              /\\u003D/g,
              "="
            )
            .trim();
        };

        const isRealInstagramImage =
          (value) => {
            if (!value) {
              return false;
            }

            if (
              !/^https?:\/\//i.test(
                value
              )
            ) {
              return false;
            }

            if (
              /static\.cdninstagram\.com/i.test(
                value
              )
            ) {
              return false;
            }

            return /scontent[^/]*\.(fbcdn|cdninstagram)|fbcdn\.net|cdninstagram\.com/i.test(
              value
            );
          };

        const images = Array.from(
          document.querySelectorAll(
            "img"
          )
        );

        const candidates =
          images
            .map((img) => ({
              src: normalize(
                img.currentSrc ||
                  img.src ||
                  img.getAttribute(
                    "src"
                  )
              ),
              alt:
                img.getAttribute(
                  "alt"
                ) || "",
              width:
                Number(
                  img.naturalWidth ||
                    img.width ||
                    0
                ),
              height:
                Number(
                  img.naturalHeight ||
                    img.height ||
                    0
                ),
              loading:
                img.getAttribute(
                  "loading"
                ) || "",
            }))
            .filter(
              (item) =>
                isRealInstagramImage(
                  item.src
                )
            );

        const unique =
          Array.from(
            new Map(
              candidates.map(
                (item) => [
                  item.src,
                  item,
                ]
              )
            ).values()
          );

        const profileByAlt =
          unique.filter(
            (item) => {
              const alt =
                item.alt
                  .toLowerCase();

              return (
                alt.includes(
                  "profile picture"
                ) ||
                alt.includes(
                  "profile photo"
                ) ||
                alt.includes(
                  "profile image"
                ) ||
                alt.includes(
                  "profile picture of"
                ) ||
                alt.includes(
                  "عکس پروفایل"
                )
              );
            }
          );

        if (
          profileByAlt.length
        ) {
          profileByAlt.sort(
            (a, b) =>
              b.width *
                b.height -
              a.width *
                a.height
          );

          return {
            url:
              profileByAlt[0].src,
            method:
              "profile-alt",
          };
        }

        const squareCandidates =
          unique.filter(
            (item) => {
              if (
                item.width <
                  150 ||
                item.height <
                  150
              ) {
                return false;
              }

              const ratio =
                item.width /
                item.height;

              return (
                ratio >= 0.95 &&
                ratio <= 1.05
              );
            }
          );

        const nonTinySquare =
          squareCandidates
            .filter(
              (item) =>
                item.width >=
                  200 &&
                item.height >=
                  200
            )
            .sort(
              (a, b) =>
                b.width *
                  b.height -
                a.width *
                  a.height
            );

        if (
          nonTinySquare.length
        ) {
          return {
            url:
              nonTinySquare[0]
                .src,
            method:
              "square-dom",
          };
        }

        const largeCandidates =
          unique
            .filter(
              (item) =>
                item.width >=
                  200 &&
                item.height >=
                  200
            )
            .sort(
              (a, b) =>
                b.width *
                  b.height -
                a.width *
                  a.height
            );

        if (
          largeCandidates.length
        ) {
          return {
            url:
              largeCandidates[0]
                .src,
            method:
              "large-dom",
          };
        }

        const metaSelectors = [
          'meta[property="og:image"]',
          'meta[property="og:image:url"]',
          'meta[name="twitter:image"]',
          'meta[name="twitter:image:src"]',
        ];

        for (
          const selector of
            metaSelectors
        ) {
          const element =
            document.querySelector(
              selector
            );

          const content =
            normalize(
              element?.getAttribute(
                "content"
              )
            );

          if (
            isRealInstagramImage(
              content
            )
          ) {
            return {
              url: content,
              method:
                "meta-fallback",
            };
          }
        }

        return null;
      });

    if (
      !profileData?.url
    ) {
      throw new Error(
        "Instagram profile picture URL was not found"
      );
    }

    console.log(
      `Instagram profile picture detected (${profileData.method}):`,
      profileData.url.slice(
        0,
        220
      )
    );

    const response =
      await context.request.get(
        profileData.url,
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
      !contentType.startsWith(
        "image/"
      )
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
