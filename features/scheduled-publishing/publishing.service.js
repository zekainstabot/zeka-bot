const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  sendFileToUser,
} = require("../../services/delivery.service");

const {
  downloadScheduledMedia,
  detectFileContentType,
} = require("../../services/scheduled-media.downloader");

const {
  parseUrl,
} = require("../../services/url.service");

const {
  updatePostStatus,
  updatePostProgress,
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

async function setProgress(postId, stage) {
  try {
    await updatePostProgress(postId, stage);
  } catch (error) {
    console.error(
      `Could not update scheduled post progress: ${postId}`,
      error?.message || error
    );
  }
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

  if (!chatId) {
    throw new Error("شناسه کانال برای انتشار تنظیم نشده است.");
  }

  const fileType = detectFileContentType(filePath);

  const typeMap = {
    PHOTO: "photo",
    VIDEO: "video",
    AUDIO: "audio",
    DOCUMENT: "document",
  };

  const contentType =
    typeMap[String(fileType).toUpperCase()] || "document";

  const result = await sendFileToUser({
    telegramChatId: chatId,
    filePath,
    caption,
    contentType,
  });

  const message = result?.response?.result;

  if (!result?.success || !message?.message_id) {
    throw new Error(
      "تلگرام فایل را ارسال کرد، اما شناسه پیام انتشار دریافت نشد."
    );
  }

  return message;
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
  let stage = "downloading";

  try {
    const parsed = validateSourceUrl(post.source_url);

    jobId = `scheduled-${post.id}-${Date.now()}`;

    await setProgress(post.id, "downloading");

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

    stage = "downloaded";
    await setProgress(post.id, "downloaded");

    const caption = buildCaption(
      post,
      downloaded.caption
    );

    stage = "sending";
    await setProgress(post.id, "sending");

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

    const failedStage =
      stage === "sending"
        ? "send_failed"
        : "download_failed";

    console.error(
      `Scheduled post failed during ${stage}: ${post.id}`,
      errorMessage
    );

    await setProgress(post.id, failedStage);

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
      stage: failedStage,
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
