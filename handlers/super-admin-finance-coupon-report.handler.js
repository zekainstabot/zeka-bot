const { Markup } = require("telegraf");

const adminService = require("../services/admin.service");

const couponReportService = require(
  "../services/pro-coupon-report.service"
);

const {
  validateCouponId,
} = require("../services/pro-coupon.service");

const PAGE_SIZE = 10;

async function getSuperAdmin(ctx) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return null;
  }

  const admin = await adminService.getAdminByTelegramId(
    telegramUserId
  );

  if (
    !admin ||
    !admin.is_active ||
    admin.role_key !== "super_admin"
  ) {
    return null;
  }

  return admin;
}

function validatePage(page) {
  const value = Number(page);

  if (
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new Error("INVALID_COUPON_REPORT_PAGE");
  }

  const offset = (value - 1) * PAGE_SIZE;

  if (!Number.isSafeInteger(offset)) {
    throw new Error("INVALID_COUPON_REPORT_PAGE");
  }

  return {
    page: value,
    offset,
  };
}

function formatDate(date) {
  if (!date) {
    return "ثبت نشده";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "نامشخص";
  }

  return parsed.toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatAmount(amount) {
  const value = Number(amount ?? 0);

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    return "نامشخص";
  }

  return (
    new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(value) + " تومان"
  );
}

function getStatusLabel(status) {
  const labels = {
    PENDING: "🟡 در انتظار پرداخت",
    WAITING_RECEIPT: "🟠 منتظر رسید",
    RECEIPT_SUBMITTED: "🔵 رسید ارسال شده",
    APPROVED: "🟢 تأیید و مصرف نهایی",
    REJECTED: "🔴 رد شده",
    CANCELLED: "⚫ لغو شده",
  };

  return (
    labels[String(status || "").toUpperCase()] ||
    `❔ ${status || "نامشخص"}`
  );
}

function getUserLabel(item) {
  if (item.username) {
    return `@${item.username}`;
  }

  if (item.display_name) {
    return item.display_name;
  }

  return "بدون نام ثبت‌شده";
}

function getCouponReleaseLabel(item) {
  if (item.released_at) {
    return (
      "🔓 زمان آزادسازی کد: " +
      formatDate(item.released_at)
    );
  }

  if (
    item.purchase_status === "APPROVED"
  ) {
    return "🔒 وضعیت کد: مصرف‌شده و آزاد نشده";
  }

  if (
    item.purchase_status === "REJECTED" ||
    item.purchase_status === "CANCELLED"
  ) {
    return "⚠️ زمان آزادسازی در تاریخچه ثبت نشده";
  }

  return "⏳ کد هنوز در انتظار تعیین تکلیف است";
}

function buildPageKeyboard(
  couponId,
  page,
  totalPages
) {
  const buttons = [];
  const navigation = [];

  if (page > 1) {
    navigation.push(
      `⬅️ صفحه قبل کد ${couponId} صفحه ${page - 1}`
    );
  }

  if (page < totalPages) {
    navigation.push(
      `صفحه بعد کد ${couponId} صفحه ${page + 1} ➡️`
    );
  }

  if (navigation.length) {
    buttons.push(navigation);
  }

  buttons.push([
    `🔄 تازه‌سازی گزارش کد ${couponId} صفحه ${page}`,
  ]);

  buttons.push([
    "🔙 مشاهده کدهای تخفیف",
  ]);

  return Markup.keyboard(buttons)
    .resize()
    .oneTime(false);
}

function buildSummaryMessage(report) {
  const summary = report.summary || {};

  return (
    "📊 آمار درخواست‌های استفاده از کد\n\n" +
    `👥 کل درخواست‌ها: ${report.total}\n` +
    `✅ تأییدشده: ${Number(summary.approved || 0)}\n` +
    `⏳ در انتظار: ${Number(summary.pending || 0)}\n` +
    `❌ ردشده: ${Number(summary.rejected || 0)}\n` +
    `🚫 لغوشده: ${Number(summary.cancelled || 0)}\n\n`
  );
}

function buildReportMessage(
  report,
  page,
  totalPages,
  offset
) {
  const coupon = report.coupon;

  const maxUses =
    coupon.max_uses === null
      ? "نامحدود"
      : Number(coupon.max_uses);

  let message =
    "👥 گزارش کاربران کد تخفیف\n\n" +
    `🎟️ کد: ${coupon.code}\n` +
    `🏷️ درصد تخفیف: ${coupon.discount_percent}٪\n` +
    `📊 سقف استفاده: ${maxUses}\n` +
    `📈 شمارنده مصرف کوپن: ${coupon.usage_count}\n` +
    `📅 شروع اعتبار: ${formatDate(coupon.starts_at)}\n` +
    `⏰ انقضا: ${formatDate(coupon.expires_at)}\n` +
    `📌 وضعیت: ${
      coupon.is_active ? "🟢 فعال" : "🔴 غیرفعال"
    }\n\n` +
    "━━━━━━━━━━━━━━\n\n" +
    buildSummaryMessage(report) +
    "━━━━━━━━━━━━━━\n\n";

  if (!report.redemptions.length) {
    message +=
      "هنوز هیچ درخواستی با این کد تخفیف ثبت نشده است.";
  } else {
    const lines = report.redemptions.map(
      (item, index) => {
        const rowNumber = offset + index + 1;

        return (
          `${rowNumber}. 👤 ${getUserLabel(item)}\n` +
          `🆔 Telegram ID: ${item.telegram_user_id}\n` +
          `🧾 شماره درخواست: ${
            item.purchase_request_id || "نامشخص"
          }\n` +
          `📦 مدت پلن: ${
            item.duration_months || "نامشخص"
          } ماه\n` +
          `🏷️ تخفیف ثبت‌شده: ${item.discount_percent}٪\n` +
          `💰 مبلغ نهایی: ${formatAmount(item.price_amount)}\n` +
          `📌 وضعیت خرید: ${getStatusLabel(item.purchase_status)}\n` +
          `📅 زمان استفاده از کد: ${formatDate(
            item.redemption_created_at
          )}\n` +
          `📅 زمان ثبت درخواست: ${formatDate(
            item.purchase_created_at
          )}\n` +
          `${getCouponReleaseLabel(item)}`
        );
      }
    );

    message += lines.join(
      "\n\n━━━━━━━━━━━━━━\n\n"
    );
  }

  message +=
    "\n\n━━━━━━━━━━━━━━\n" +
    `📄 صفحه ${page} از ${totalPages}`;

  return message;
}

async function fetchReport(couponId, offset) {
  return couponReportService.getCouponUsageReport(
    couponId,
    {
      limit: PAGE_SIZE,
      offset,
    }
  );
}

async function showCouponUsageReport(
  ctx,
  couponId,
  page = 1
) {
  try {
    const admin = await getSuperAdmin(ctx);

    if (!admin) {
      await ctx.reply(
        "⛔ فقط Super Admin به این گزارش دسترسی دارد."
      );
      return;
    }

    const safeCouponId = validateCouponId(couponId);

    const pagination = validatePage(page);

    let report = await fetchReport(
      safeCouponId,
      pagination.offset
    );

    if (!report) {
      await ctx.reply(
        "❌ کد تخفیف موردنظر پیدا نشد.",
        Markup.keyboard([
          ["🔙 مشاهده کدهای تخفیف"],
        ]).resize()
      );

      return;
    }

    const totalPages = Math.max(
      1,
      Math.ceil(report.total / PAGE_SIZE)
    );

    let safePage = pagination.page;
    let safeOffset = pagination.offset;

    if (safePage > totalPages) {
      safePage = totalPages;
      safeOffset = (safePage - 1) * PAGE_SIZE;

      report = await fetchReport(
        safeCouponId,
        safeOffset
      );

      if (!report) {
        await ctx.reply(
          "❌ کد تخفیف موردنظر پیدا نشد."
        );
        return;
      }
    }

    const message = buildReportMessage(
      report,
      safePage,
      totalPages,
      safeOffset
    );

    await ctx.reply(
      message,
      buildPageKeyboard(
        safeCouponId,
        safePage,
        totalPages
      )
    );
  } catch (error) {
    if (
      error.message === "INVALID_COUPON_ID" ||
      error.message === "INVALID_COUPON_REPORT_PAGE"
    ) {
      await ctx.reply(
        "❌ شناسه کد تخفیف یا شماره صفحه معتبر نیست."
      );
      return;
    }

    console.error(
      "Coupon usage report failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت گزارش کاربران این کد انجام نشد.",
      Markup.keyboard([
        ["🔙 مشاهده کدهای تخفیف"],
      ]).resize()
    );
  }
}

function createSuperAdminFinanceCouponReportHandler(bot) {
  bot.hears(
    /^👥 کاربران کد (\d+)$/,
    async (ctx) => {
      const match = String(
        ctx.message?.text || ""
      ).match(/^👥 کاربران کد (\d+)$/);

      if (!match) {
        return;
      }

      await showCouponUsageReport(
        ctx,
        match[1],
        1
      );
    }
  );

  bot.hears(
    /^(⬅️ صفحه قبل کد|صفحه بعد کد) (\d+) صفحه (\d+)(?: ➡️)?$/,
    async (ctx) => {
      const match = String(
        ctx.message?.text || ""
      ).match(
        /^(⬅️ صفحه قبل کد|صفحه بعد کد) (\d+) صفحه (\d+)(?: ➡️)?$/
      );

      if (!match) {
        return;
      }

      await showCouponUsageReport(
        ctx,
        match[2],
        match[3]
      );
    }
  );

  bot.hears(
    /^🔄 تازه‌سازی گزارش کد (\d+) صفحه (\d+)$/,
    async (ctx) => {
      const match = String(
        ctx.message?.text || ""
      ).match(
        /^🔄 تازه‌سازی گزارش کد (\d+) صفحه (\d+)$/
      );

      if (!match) {
        return;
      }

      await showCouponUsageReport(
        ctx,
        match[1],
        match[2]
      );
    }
  );
}

module.exports = {
  createSuperAdminFinanceCouponReportHandler,
};
