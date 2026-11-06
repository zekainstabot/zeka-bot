const {
  downloadInstagramMedia,
} = require("./instagram.downloader");

const {
  downloadTikTokMedia,
} = require("./tiktok.downloader");

function detectPlatform(originalUrl) {
  if (!originalUrl) {
    throw new Error("لینک منبع درخواست ثبت نشده است.");
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(originalUrl);
  } catch {
    throw new Error("لینک منبع معتبر نیست.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("لینک منبع باید HTTPS باشد.");
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (
    hostname === "instagram.com" ||
    hostname.endsWith(".instagram.com")
  ) {
    return "instagram";
  }

  if (
    hostname === "tiktok.com" ||
    hostname.endsWith(".tiktok.com")
  ) {
    return "tiktok";
  }

  throw new Error(
    `پلتفرم لینک پشتیبانی نمی‌شود: ${hostname}`
  );
}

async function recoverZekaMediaFile(queueItem) {
  if (!queueItem?.id) {
    throw new Error("شناسه درخواست زکا مدیا معتبر نیست.");
  }

  if (!queueItem.original_url) {
    throw new Error("لینک اصلی این درخواست در دیتابیس موجود نیست.");
  }

  const platform = detectPlatform(queueItem.original_url);

  const recoveryJobId = [
    "zeka-media-recovery",
    queueItem.id,
    Date.now(),
  ].join("-");

  console.log(
    `Zeka Media recovery started: ${queueItem.id} (${platform})`
  );

  let result;

  if (platform === "instagram") {
    result = await downloadInstagramMedia({
      url: queueItem.original_url,
      jobId: recoveryJobId,
      contentType: "OTHER",
    });
  } else {
    result = await downloadTikTokMedia({
      url: queueItem.original_url,
      jobId: recoveryJobId,
    });
  }

  if (
    !result?.success ||
    !result.filePath ||
    !result.contentType
  ) {
    throw new Error(
      "دانلود مجدد انجام شد اما فایل معتبر دریافت نشد."
    );
  }

  console.log(
    `Zeka Media recovery completed: ${queueItem.id}`,
    result.filePath
  );

  return {
    filePath: result.filePath,
    contentType: result.contentType,
    sourceUrl: result.sourceUrl || queueItem.original_url,
    caption: result.caption || "",
  };
}

module.exports = {
  recoverZekaMediaFile,
  detectPlatform,
};
