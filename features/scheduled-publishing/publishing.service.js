const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  downloadScheduledMedia,
  detectFileContentType,
} = require("../../services/scheduled-media.downloader");

const {
  parseUrl,
} = require("../../services/url.service");

const {
  updatePostStatus,
} = require("./publishing.repository");

function validateSourceUrl(input) {
  const parsed = parseUrl(input);

  if (!parsed.valid || !parsed.url || !parsed.platform) {
    throw new Error(
      "لینک معتبر نیست یا پلتفرم آن پشتیبانی نمی‌شود."
    );
  }

  return parsed;
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
  if (!fs.existsSync(filePath)) {
    throw new Error("فایل رسانه برای انتشار پیدا نشد.");
  }

  const fileType = detectFileContentType(filePath);
  const options = caption ? { caption } : {};
  const media = { source: filePath };

  if (fileType === "PHOTO") {
    return bot.telegram.sendPhoto(chatId, media, options);
  }

  if (fileType === "VIDEO") {
    return bot.telegram.sendVideo(chatId, media, options);
  }

  return bot.telegram.sendDocument(chatId, media, options);
}

async function publishScheduledPost(post, bot) {
  if (!post || !post.id) {
    throw new Error("اطلاعات پست زمان‌بندی‌شده ناقص است.");
  }

  if (!bot || !bot.telegram) {
    throw new Error("ربات تلگرام مقداردهی نشده است.");
  }

  let downloaded = null;
  let jobId = null;

  try {
    const parsed = validateSourceUrl(post.source_url);

    jobId = `scheduled-${post.id}-${Date.now()}`;

    downloaded = await downloadScheduledMedia({
      url: parsed.url,
      jobId,
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
      `Scheduled post published: ${post.id} (${parsed.platform})`
    );

    return {
      success: true,
      postId: post.id,
      messageId: message.message_id,
      platform: parsed.platform,
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
    if (jobId) {
      const directories = [
        path.join(os.tmpdir(), "zeka-instagram", jobId),
        path.join(os.tmpdir(), "zeka-tiktok", jobId),
        path.join(os.tmpdir(), "zeka-scheduled-media", jobId),
      ];

      for (const directory of directories) {
        try {
          fs.rmSync(directory, {
            recursive: true,
            force: true,
          });
        } catch (cleanupError) {
          console.error(
            "Scheduled publishing cleanup failed:",
            cleanupError?.message || cleanupError
          );
        }
      }
    }
  }
}

module.exports = {
  publishScheduledPost,
};
