function createDownloadHandler({
  bot,
  mainMenu,
  downloadMenu,
}) {
  const {
    getOrCreateUser,
  } = require("../services/user.service");

  const {
    parseUrl,
  } = require("../services/url.service");

  const {
    createDownloadRequest,
  } = require("../services/request.service");

  const {
    sendDownloadReport,
  } = require("../services/report.service");

    const {
    getBalance,
    shouldConsumeCredit,
  } = require("../services/credit.service");

  const {
    getDownloadCost,
  } = require("../services/cost.service");

  const jobRepository =
    require("../repositories/job.repository");

  const activeWatchers = new Map();
  const reportStates = new Map();
  const downloadStates = new Map();

  function isDownloadMode(userId) {
    return downloadStates.has(String(userId));
  }

  function enableDownloadMode(userId) {
    downloadStates.set(String(userId), {
      createdAt: Date.now(),
    });
  }

  function disableDownloadMode(userId) {
    downloadStates.delete(String(userId));
  }

  function formatElapsed(seconds) {
    const safeSeconds = Math.max(
      0,
      Number(seconds) || 0
    );

    const minutes = Math.floor(
      safeSeconds / 60
    );

    const remainingSeconds =
      safeSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  }

  function statusKeyboard(jobId) {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🐞 گزارش اشکال",
              callback_data:
                `download_report:${jobId}`,
            },
          ],
        ],
      },
    };
  }

  async function watchJob({
    ctx,
    jobId,
    messageId,
    userId,
  }) {
    const key =
      `${ctx.chat.id}:${messageId}`;

    if (activeWatchers.has(key)) {
      return;
    }

    const startedAt = Date.now();

    const watcher = {
      stopped: false,
      timer: null,
    };

    activeWatchers.set(
      key,
      watcher
    );

    const stop = () => {
      if (watcher.stopped) {
        return;
      }

      watcher.stopped = true;

      if (watcher.timer) {
        clearTimeout(
          watcher.timer
        );
      }

      activeWatchers.delete(key);
    };

    const update = async () => {
      if (watcher.stopped) {
        return;
      }

      try {
        const job =
          await jobRepository.findById(
            jobId
          );

        if (!job) {
          stop();
          return;
        }

        const elapsed =
          Math.floor(
            (Date.now() - startedAt) /
              1000
          );

        if (
          job.status === "COMPLETED"
        ) {
          stop();

          try {
            await ctx.telegram.deleteMessage(
              ctx.chat.id,
              messageId
            );
          } catch (error) {
            console.error(
              "Failed to delete download status message:",
              error
            );
          }

          return;
        }

        if (
          job.status === "FAILED" ||
          job.status === "CANCELLED"
        ) {
          stop();

          try {
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              messageId,
              undefined,
              "❌ دانلود انجام نشد.\n\n" +
                `⏱ زمان: ${formatElapsed(
                  elapsed
                )}\n\n` +
                "اگر مشکل ادامه داشت، گزارش اشکال را بزن.",
              statusKeyboard(job.id)
            );
          } catch (error) {
            console.error(
              "Failed to update failed download message:",
              error
            );
          }

          return;
        }

        let status =
          "⚙️ در حال آماده‌سازی...";

        if (
          job.status === "PROCESSING"
        ) {
          status =
            "⚙️ در حال پردازش...";
        } else if (
          job.status === "DOWNLOADING"
        ) {
          status =
            "📥 در حال دانلود...";
        } else if (
          job.status === "SENDING"
        ) {
          status =
            "📤 فایل آماده شد؛ در حال ارسال...";
        } else if (
          job.status === "WAITING"
        ) {
          status =
            "⏳ در صف پردازش...";
        }

        try {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            messageId,
            undefined,
            `${status}\n\n` +
              `⏱ زمان: ${formatElapsed(
                elapsed
              )}`,
            statusKeyboard(job.id)
          );
        } catch (error) {
          const message =
            String(
              error?.message || ""
            );

          if (
            !message.includes(
              "message is not modified"
            )
          ) {
            console.error(
              "Failed to update download status:",
              error
            );
          }
        }

        watcher.timer =
          setTimeout(
            update,
            2000
          );
      } catch (error) {
        console.error(
          "Download status watcher failed:",
          error
        );

        watcher.timer =
          setTimeout(
            update,
            5000
          );
      }
    };

    await update();
  }

      bot.hears(
    "📥 دانلود",
    async (ctx) => {
      enableDownloadMode(ctx.from.id);

      await ctx.reply(
        "📥 حالت دانلود فعال شد.\n\n" +
          "حالا لینک محتوایی که می‌خواهی دانلود شود را ارسال کن.\n\n" +
          "مثال:\n" +
          "https://www.instagram.com/...",
        downloadMenu
      );
    }
  );

  bot.hears(
    "🔙 بازگشت",
    async (ctx) => {
      disableDownloadMode(ctx.from.id);

      await ctx.reply(
        "🏠 منوی اصلی",
        mainMenu
      );
    }
  );

  bot.action(
    /^download_report:(.+)$/,
    async (ctx) => {
      try {
        await ctx.answerCbQuery();

        const jobId =
          String(
            ctx.match?.[1] || ""
          ).trim();

        if (!jobId) {
          await ctx.reply(
            "❌ اطلاعات درخواست دانلود پیدا نشد.",
            mainMenu
          );

          return;
        }

        const job =
          await jobRepository.findById(
            jobId
          );

        if (!job) {
          await ctx.reply(
            "❌ اطلاعات این دانلود دیگر در دسترس نیست.",
            mainMenu
          );

          return;
        }

        const user =
          await getOrCreateUser(
            ctx.from
          );

        reportStates.set(
          String(ctx.from.id),
          {
            chatId: ctx.chat.id,
            jobId: job.id,
            originalUrl:
              job.original_url ||
              "ثبت نشده",
            user,
            createdAt: Date.now(),
          }
        );

        await ctx.reply(
          "🐞 گزارش اشکال\n\n" +
            "مشکلی که در دانلود داشتی را در یک پیام بنویس.\n\n" +
            "مثلاً:\n" +
            "• فایل دانلود نشد\n" +
            "• فایل باز نمی‌شود\n" +
            "• دانلود خیلی طول کشید\n" +
            "• فایل ناقص است\n\n" +
            "✏️ متن مشکلت را ارسال کن:"
        );
      } catch (error) {
        console.error(
          "Download report action failed:",
          error
        );

        await ctx.reply(
          "❌ ثبت گزارش انجام نشد.\nلطفاً دوباره تلاش کن.",
          mainMenu
        );
      }
    }
  );

  bot.on("text", async (ctx) => {
    const text =
      ctx.message.text.trim();

    if (!text) {
      return;
    }

    if (
      text.startsWith("/")
    ) {
      return;
    }

    const userId =
      String(ctx.from.id);

    const reportState =
      reportStates.get(userId);

    if (reportState) {
      reportStates.delete(userId);

      if (
        Date.now() -
          reportState.createdAt >
        10 * 60 * 1000
      ) {
        await ctx.reply(
          "⏱ زمان ثبت گزارش تمام شده است.\n\n" +
            "لطفاً دوباره روی «🐞 گزارش اشکال» بزن.",
          mainMenu
        );

        return;
      }

      try {
        const user =
          reportState.user ||
          await getOrCreateUser(
            ctx.from
          );

        const result =
          await sendDownloadReport({
            user,
            report: text,
            originalUrl:
              reportState.originalUrl,
            jobId:
              reportState.jobId,
          });

        if (result.sent) {
          await ctx.reply(
            "✅ گزارش شما ارسال شد.\n\n" +
              "گزارش برای ادمین زکا ارسال شد و بررسی می‌شود.",
            mainMenu
          );
        } else {
          await ctx.reply(
            "⚠️ گزارش شما دریافت شد، اما ارسال آن برای ادمین انجام نشد.\n\n" +
              "لطفاً بعداً دوباره تلاش کن.",
            mainMenu
          );
        }
      } catch (error) {
        console.error(
          "Download report submission failed:",
          error
        );

        await ctx.reply(
          "❌ ارسال گزارش انجام نشد.\nلطفاً دوباره تلاش کن.",
          mainMenu
        );
      }

      return;
    }

    if (!isDownloadMode(userId)) {
      return;
    }

    const menuButtons = [
      "📥 دانلود",
      "👤 حساب من",
      "🎁 هدایا",
      "⭐ زکا پرو",
      "🎮 مینی‌گیم‌ها",
      "🎡 گردونه شانس",
      "🧠 مسابقه",
      "❌ لغو مسابقه",
      "🛠 امکانات ویژه",
      "📚 راهنما",
      "📊 اعتبار من",
      "🏆 سطح و XP",
      "🌐 زبان",
      "👤 اطلاعات حساب",
      "🔙 بازگشت",
      "🧠 مدیریت مسابقه",
      "➕ افزودن سؤال",
      "🔙 پنل مدیریت",
      "🔙 خروج از پنل مدیریت",
      "❌ لغو",
    ];

    if (
      menuButtons.includes(text)
    ) {
      return;
    }

    try {
      const user =
        await getOrCreateUser(
          ctx.from
        );

      const parsed =
        parseUrl(text);

      if (!parsed.valid) {
        await ctx.reply(
          "❌ لینک معتبر نیست.\n\n" +
            "یک لینک کامل مثل این ارسال کن:\n" +
            "https://www.instagram.com/...",
          mainMenu
        );

        return;
      }

      if (!parsed.platform) {
        await ctx.reply(
          "⚠️ این لینک متعلق به پلتفرم‌های پشتیبانی‌شده نیست.",
          mainMenu
        );

        return;
      }

      const result =
        await createDownloadRequest({
          userId: user.id,
          platform:
            parsed.platform,
          originalUrl: text,
          normalizedUrl:
            parsed.url,
          contentType:
            parsed.contentType,
        });

      const job =
        result.job;

            const consumesCredit =
        await shouldConsumeCredit(user.id);

      const downloadCost =
        getDownloadCost(parsed.contentType);

      const remainingCredit =
        await getBalance(user.id);

      const creditMessage = consumesCredit
        ? `💳 هزینه دانلود: ${downloadCost} اعتبار\n` +
          `💰 مانده اعتبار: ${remainingCredit} اعتبار`
        : "⭐ زکا پرو: دانلود بدون کسر اعتبار";

      const statusMessage =
        await ctx.reply(
          "⏳ درخواستت ثبت شد.\n\n" +
            creditMessage +
            "\n\n" +
            "⚙️ در حال آماده‌سازی فایل...\n\n" +
            "⏱ زمان: 00:00",
          statusKeyboard(job.id)
        );
      watchJob({
        ctx,
        jobId: job.id,
        messageId:
          statusMessage.message_id,
      }).catch((error) => {
        console.error(
          "Failed to watch download:",
          error
        );
      });
    } catch (error) {
      console.error(
        "Download request failed:",
        error
      );

      if (
        error &&
        error.code ===
          "DUPLICATE_ACTIVE_REQUEST"
      ) {
        await ctx.reply(
          "⏳ این لینک در حال حاضر در صف پردازش است.\n\n" +
            "لطفاً صبر کن تا دانلود قبلی تمام شود.",
          mainMenu
        );

        return;
      }

      if (
        error &&
        error.code ===
          "PLATFORM_DISABLED"
      ) {
        await ctx.reply(
          `⚠️ دانلود از ${
            error.platform
          } در حال حاضر غیرفعال است.\n\n` +
            "لطفاً بعداً دوباره تلاش کن.",
          mainMenu
        );

        return;
      }

      await ctx.reply(
        "❌ ثبت درخواست انجام نشد.\nلطفاً دوباره تلاش کنید.",
        mainMenu
      );
    }
  });
}

module.exports = {
  createDownloadHandler,
};
