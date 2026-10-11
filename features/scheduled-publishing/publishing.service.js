const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  downloadInstagramMedia,
  detectFileContentType,
} = require("../../services/instagram.downloader");

const {
  updatePostStatus,
} = require("./publishing.repository");

function detectInstagramContentType(url) {
  const parsedUrl = new URL(url);
  const parts = parsedUrl.pathname
    .split("/")
    .filter(Boolean)
    .map((part) => part.toLowerCase());

  if (parts.includes("stories")) {
    return "STORY";
  }

  if (parts.includes("reel") || parts.includes("reels")) {
    return "REEL";
  }

  if (parts.includes("tv")) {
    return "VIDEO";
  }

  if (parts.includes("p")) {
    return "POST";
  }

  return "OTHER";
}

function validateInstagramUrl(url) {
  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("لینک واردشده معتبر نیست.");
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (
    parsedUrl.protocol !== "https:" ||
    ![
      "instagram.com",
      "www.instagram.com",
      "m.instagram.com",
    ].includes(hostname)
  ) {
    throw new Error(
      "فعلاً انتشار زمان‌بندی‌شده فقط از لینک‌های اینستاگرام پشتیبانی می‌کند."
    );
  }

  return parsedUrl.toString();
}

function buildCaption(post, downloadedCaption) {
  const originalCaption = String(
    post.original_caption || downloadedCaption || ""
  ).trim();

  const customCaption = String(
    post.custom_caption || ""
  ).trim();

  let caption = "";

  switch (post.caption_mode) {
    case "none":
      caption = "";
      break;

    case "custom":
      caption = customCaption;
      break;

    case "both": {
      const captions =
        post.caption_order === "custom_first"
          ? [customCaption, originalCaption]
          : [originalCaption, customCaption];

      caption = captions.filter(Boolean).join("\n\n");
      break;
    }

    case "original":
    default:
      caption = originalCaption;
      break;
  }

  if (caption.length > 1024) {
    caption = caption.slice(0, 1021) + "...";
  }

  return caption;
}

async function sendMediaToChannel({
  bot,
  chatId,
  filePath,
  caption,
}) {
  const fileType = detectFileContentType(filePath);
  const options = caption ? { caption } : {};

  if (fileType === "PHOTO") {
    return bot.telegram.sendPhoto(
      chatId,
      { source: filePath },
      options
    );
  }

  if (fileType === "VIDEO") {
    return bot.telegram.sendVideo(
      chatId,
      { source: filePath },
      options
    );
  }

  return bot.telegram.sendDocument(
    chatId,
    { source: filePath },
    options
  );
}

async function publishScheduledPost(post, bot) {
  if (!post || !post.id) {
    throw new Error("اطلاعات پست زمان‌بندی‌شده ناقص است.");
  }

  if (!bot || !bot.telegram) {
    throw new Error("ربات تلگرام مقداردهی نشده است.");
  }

  let jobId = null;
  let jobDirectory = null;

  try {
    const sourceUrl = validateInstagramUrl(
      post.source_url
    );

    jobId = `scheduled-${post.id}-${Date.now()}`;

    jobDirectory = path.join(
      os.tmpdir(),
      "zeka-instagram",
      jobId
    );

    const downloaded = await downloadInstagramMedia({
      url: sourceUrl,
      jobId,
      contentType: detectInstagramContentType(sourceUrl),
    });

    if (
      !downloaded ||
      !downloaded.success ||
      !downloaded.filePath ||
      !fs.existsSync(downloaded.filePath)
    ) {
      throw new Error("دانلود رسانه با موفقیت انجام نشد.");
    }

    const caption = buildCaption(
      post,
      downloaded.caption
    );

    const message = await sendMediaToChannel({
      bot,
      chatId: post.telegram_chat_id,
      filePath: downloaded.filePath,
      caption,
    });

    await updatePostStatus(post.id, "published", {
      telegramMessageId: message.message_id,
      errorMessage: null,
    });

    console.log(
      `Scheduled post published: ${post.id}`
    );

    return {
      success: true,
      postId: post.id,
      messageId: message.message_id,
    };
  } catch (error) {
    const errorMessage = String(
      error?.message || error
    ).slice(0, 2000);

    console.error(
      `Scheduled post failed: ${post.id}`,
      errorMessage
    );

    try {
      await updatePostStatus(post.id, "failed", {
        errorMessage,
      });
    } catch (statusError) {
      console.error(
        `Could not update scheduled post status: ${post.id}`,
        statusError?.message || statusError
      );
    }

    return {
      success: false,
      postId: post.id,
      error: errorMessage,
    };
  } finally {
    if (jobDirectory) {
      try {
        fs.rmSync(jobDirectory, {
          recursive: true,
          force: true,
        });
      } catch (cleanupError) {
        console.error(
          "Scheduled publishing temporary-file cleanup failed:",
          cleanupError?.message || cleanupError
        );
      }
    }
  }
}

module.exports = {
  publishScheduledPost,
};
