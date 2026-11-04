
const { Markup } = require("telegraf");

const adminService = require("../services/admin.service");

const couponReportService = require(
  "../services/pro-coupon-report.service"
);

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
  const value = Number(amount || 0);

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

  return labels[String(status || "").toUpperCase()] ||
    `❔ ${status || "نامشخص"}`;
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

function buildPageKeyboard(
  couponId,
  page,
  totalPages
) {
  const buttons = [];

  const navigation = [];

  if (page > 0) {
    navigation.push(
      `⬅️ صفحه قبل کد ${couponId} صفحه ${page}`
    );
  }

  if (page + 1 < totalPages) {
    navigation.push(
      `صفحه بعد کد ${couponId} صفحه ${page + 2} ➡️`
    );
  }

  if (navigation.length) {
    buttons.push(navigation);
  }

  buttons.push(
    ["🔄 تازه‌سازی گزارش"],
    ["🔙 مشاهده کدهای تخفیف"]
  );

  return Markup.keyboard(buttons)
    .resize()
    .oneTime(false);
}

async function showCouponUsageReport(
  ctx,
  couponId,
  page = 1
) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply("⛔ فقط Super Admin به این گزارش دسترسی دارد.");
    return;
  }

  const safePage = Math.max(
    1,
    Math.floor(Number(page) || 1)
  );

  const offset = (safePage - 1) * PAGE_SIZE;

  try {
    const report = await couponReportService.getCouponUsageReport(
      couponId,
      {
        limit: PAGE_SIZE,
        offset,
      }
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

    if (safePage > totalPages) {
      await showCouponUsageReport(
        ctx,
        couponId,
        totalPages
      );
      return;
    }

    const coupon = report.coupon;

    let message =
      "👥 گزارش کاربران کد تخفیف\n\n" +
      `🎟️ کد: ${coupon.code}\n` +
      `🏷️ درصد تخفیف: ${coupon.discount_percent}٪\n` +
      `📊 تعداد ثبت‌شده: ${report.total}\n` +
      `📈 شمارنده کوپن: ${coupon.usage_count}\n` +
      `📌 وضعیت: ${coupon.is_active ? "🟢 فعال" : "🔴 غیرفعال"}\n\n` +
      "━━━━━━━━━━━━━━\n\n";

    if (!report.redemptions.length) {
      message +=
        "هنوز هیچ کاربری از این کد استفاده نکرده است.";
    } else {
      const lines = report.redemptions.map(
        (item, index) => {
          const rowNumber = offset + index + 1;

          const username = getUserLabel(item);

          const status = getStatusLabel(
            item.purchase_status
          );

          return (
            `${rowNumber}. 👤 ${username}\n` +
            `🆔 Telegram ID: ${item.telegram_user_id}\n` +
            `🧾 شماره درخواست: ${item.purchase_request_id || "نامشخص"}\n` +
            `📦 مدت پلن: ${item.duration_months || "نامشخص"} ماه\n` +
            `🏷️ تخفیف ثبت‌شده: ${item.discount_percent}٪\n` +
            `💰 مبلغ نهایی: ${formatAmount(item.price_amount)}\n` +
            `📌 وضعیت خرید: ${status}\n` +
            `📅 زمان ثبت کد: ${formatDate(item.redemption_created_at)}`
          );
        }
      );

      message += lines.join(
        "\n\n━━━━━━━━━━━━━━\n\n"
      );
    }

    message +=
      "\n\n━━━━━━━━━━━━━━\n" +
      `📄 صفحه ${safePage} از ${totalPages}`;

    await ctx.reply(
      message,
      buildPageKeyboard(
        couponId,
        safePage - 1,
        totalPages
      )
    );
  } catch (error) {
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
        Number(match[1]),
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
        Number(match[2]),
        Number(match[3])
      );
    }
  );

  bot.hears(
    "🔄 تازه‌سازی گزارش",
    async (ctx) => {
      // برای تازه‌سازی، کاربر می‌تواند دوباره دکمه گزارش همان کد را بزند.
      await ctx.reply(
        "برای تازه‌سازی گزارش، دوباره دکمه «👥 کاربران کد» مربوط به همان کد را انتخاب کن."
      );
    }
  );
}

module.exports = {
  createSuperAdminFinanceCouponReportHandler,
};
