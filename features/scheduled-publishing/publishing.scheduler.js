
const {
  claimDueScheduledPosts,
  recoverStuckScheduledPosts,
} = require("./publishing.repository");

const {
  publishScheduledPost,
} = require("./publishing.service");

const POLL_INTERVAL_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 60_000;
const BATCH_SIZE = 5;

let schedulerTimer = null;
let heartbeatTimer = null;
let isRunning = false;
let botInstance = null;
let lastCheckAt = null;

async function processDuePosts() {
  if (isRunning) {
    return;
  }

  isRunning = true;
  lastCheckAt = new Date().toISOString();

  try {
    const posts = await claimDueScheduledPosts(BATCH_SIZE);

    if (posts.length > 0) {
      console.log(
        `Scheduled publishing: ${posts.length} post(s) claimed.`
      );

      for (const post of posts) {
        try {
          await publishScheduledPost(post, botInstance);
        } catch (error) {
          console.error(
            "Scheduled publishing post handler failed:",
            {
              postId: post.id,
              message: error?.message || String(error),
            }
          );
        }
      }
    }
  } catch (error) {
    console.error(
      "Scheduled publishing scheduler failed:",
      error?.message || error
    );
  } finally {
    isRunning = false;
  }
}

function startScheduledPublishing(bot) {
  if (!bot || !bot.telegram) {
    throw new Error(
      "Telegram bot must be initialized before starting the scheduler."
    );
  }

  if (schedulerTimer) {
    console.log("Scheduled publishing scheduler already running.");
    return;
  }

  botInstance = bot;

  console.log(
    `Scheduled publishing scheduler started. Poll interval: ${POLL_INTERVAL_MS}ms; batch size: ${BATCH_SIZE}.`
  );

  recoverStuckScheduledPosts()
    .then((count) => {
      if (count > 0) {
        console.log(
          `Scheduled publishing recovered ${count} interrupted post(s).`
        );
      } else {
        console.log(
          "Scheduled publishing recovery finished; no interrupted posts found."
        );
      }
    })
    .catch((error) => {
      console.error(
        "Scheduled publishing recovery failed:",
        error?.message || error
      );
    })
    .finally(() => {
      processDuePosts();
    });

  schedulerTimer = setInterval(() => {
    processDuePosts();
  }, POLL_INTERVAL_MS);

  heartbeatTimer = setInterval(() => {
    console.log(
      "Scheduled publishing scheduler heartbeat:",
      {
        running: Boolean(schedulerTimer),
        processing: isRunning,
        lastCheckAt,
        pollIntervalMs: POLL_INTERVAL_MS,
      }
    );
  }, HEARTBEAT_INTERVAL_MS);
}

function stopScheduledPublishing() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  botInstance = null;

  console.log("Scheduled publishing scheduler stopped.");
}

module.exports = {
  startScheduledPublishing,
  stopScheduledPublishing,
};
