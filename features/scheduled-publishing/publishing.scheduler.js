const {
  claimDueScheduledPosts,
} = require("./publishing.repository");

const {
  publishScheduledPost,
} = require("./publishing.service");

const POLL_INTERVAL_MS = 15_000;
const BATCH_SIZE = 5;

let schedulerTimer = null;
let isRunning = false;

async function processDuePosts(bot) {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const posts = await claimDueScheduledPosts(
      BATCH_SIZE
    );

    if (!posts.length) {
      return;
    }

    console.log(
      `Scheduled publishing: ${posts.length} post(s) claimed.`
    );

    for (const post of posts) {
      await publishScheduledPost(post, bot);
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
    return;
  }

  console.log(
    "Scheduled publishing scheduler started."
  );

  processDuePosts(bot).catch((error) => {
    console.error(
      "Initial scheduled publishing check failed:",
      error?.message || error
    );
  });

  schedulerTimer = setInterval(() => {
    processDuePosts(bot).catch((error) => {
      console.error(
        "Scheduled publishing check failed:",
        error?.message || error
      );
    });
  }, POLL_INTERVAL_MS);

  if (typeof schedulerTimer.unref === "function") {
    schedulerTimer.unref();
  }
}

function stopScheduledPublishing() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }

  console.log(
    "Scheduled publishing scheduler stopped."
  );
}

module.exports = {
  startScheduledPublishing,
  stopScheduledPublishing,
};
