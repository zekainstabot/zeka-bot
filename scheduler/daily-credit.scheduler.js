const { getClient } = require("../database/client");
const {
  createDailyCreditsForUser,
} = require("../services/daily-credit.service");

const INTERVAL_MS = 5 * 60 * 1000;

let schedulerTimer = null;
let isRunning = false;

async function processDailyCredits() {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const db = getClient();

    const result = await db.query(`
      SELECT id
      FROM users
      ORDER BY id ASC
    `);

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of result.rows) {
      try {
        const dailyResult =
          await createDailyCreditsForUser(user.id);

        if (dailyResult.created) {
          processed++;
        } else {
          skipped++;
        }
      } catch (error) {
        failed++;

        console.error(
          `Daily credit failed for user ${user.id}:`,
          error
        );
      }
    }

    console.log(
      `Daily credit scheduler finished. ` +
        `Users: ${result.rows.length}, ` +
        `Created: ${processed}, ` +
        `Skipped: ${skipped}, ` +
        `Failed: ${failed}`
    );
  } catch (error) {
    console.error(
      "Daily credit scheduler failed:",
      error
    );
  } finally {
    isRunning = false;
  }
}

function startDailyCreditScheduler() {
  if (schedulerTimer) {
    return;
  }

  console.log(
    "Daily credit scheduler started."
  );

  /*
   * یک بار هنگام بالا آمدن برنامه اجرا می‌شود.
   * این باعث می‌شود اگر Render هنگام نیمه‌شب خاموش بوده،
   * اولین اجرای بعدی اعتبار روز را ایجاد کند.
   */
  processDailyCredits();

  /*
   * هر ۵ دقیقه بررسی می‌کنیم.
   * بنابراین وابسته به اجرای دقیق در ساعت ۰۰:۰۰ نیستیم.
   */
  schedulerTimer = setInterval(
    processDailyCredits,
    INTERVAL_MS
  );
}

function stopDailyCreditScheduler() {
  if (!schedulerTimer) {
    return;
  }

  clearInterval(schedulerTimer);
  schedulerTimer = null;

  console.log(
    "Daily credit scheduler stopped."
  );
}

module.exports = {
  startDailyCreditScheduler,
  stopDailyCreditScheduler,
  processDailyCredits,
};
