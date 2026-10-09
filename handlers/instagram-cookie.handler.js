
const { getAdminByTelegramId } = require("../services/admin.service");
const {
  saveInstagramCookie,
  hasInstagramCookie,
  deleteInstagramCookie,
} = require("../services/instagram-cookie.service");

const COOKIE_BUTTON = "🍪 کوکی اینستاگرام";
const DELETE_BUTTON = "🗑 حذف کوکی اینستاگرام";
const MAX_COOKIE_BYTES = 1024 * 1024;
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;
const pendingUploads = new Map();

async function isSuperAdmin(ctx) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return false;

  const admin = await getAdminByTelegramId(telegramId);

  return Boolean(
    admin && admin.is_active && admin.role_key === "super_admin"
  );
}

async function showCookieMenu(ctx) {
  if (!(await isSuperAdmin(ctx))) {
    await ctx.reply("⛔ فقط Super Admin به این بخش دسترسی دارد.");
    return;
  }

  try {
    const exists = await hasInstagramCookie();

    await ctx.reply(
      "🍪 مدیریت کوکی اینستاگرام\n\n" +
        (exists
          ? "وضعیت: یک کوکی ذخیره شده است. می‌توانی آن را جایگزین کنی."
          : "هنوز کوکی ذخیره نشده است.") +
        "\n\nبرای ثبت یا جایگزینی، دکمه «دریافت فایل کوکی» را بزن.\n" +
        "فایل باید خروجی Netscape با پسوند .txt و حداکثر ۱ مگابایت باشد.",
      {
        reply_markup: {
          keyboard: [
            ["📤 دریافت فایل کوکی"],
            [DELETE_BUTTON],
            ["🔙 پنل Super Admin"],
          ],
          resize_keyboard: true,
          one_time_keyboard: false,
        },
      }
    );
  } catch (error) {
    console.error("Instagram cookie status check failed.");
    await ctx.reply("❌ بررسی وضعیت کوکی انجام نشد.");
  }
}

async function requestCookieUpload(ctx) {
  if (!(await isSuperAdmin(ctx))) {
    await ctx.reply("⛔ فقط Super Admin مجاز است.");
    return;
  }

  pendingUploads.set(ctx.from.id, Date.now() + UPLOAD_WINDOW_MS);

  await ctx.reply(
    "فایل کوکی اینستاگرام را در همین چت ارسال کن.\n\n" +
      "فقط فایل .txt با فرمت Netscape، حداکثر ۱ مگابایت، تا ۱۰ دقیقه آینده پذیرفته می‌شود.\n" +
      "تا ذخیره موفق فایل جدید، کوکی قبلی حفظ می‌شود."
  );
}

async function receiveCookieFile(ctx) {
  const telegramId = ctx.from?.id;

  if (!telegramId || !pendingUploads.has(telegramId)) return;

  if (!(await isSuperAdmin(ctx))) {
    pendingUploads.delete(telegramId);
    await ctx.reply("⛔ فقط Super Admin مجاز است.");
    return;
  }

  if (Date.now() > pendingUploads.get(telegramId)) {
    pendingUploads.delete(telegramId);
    await ctx.reply("⌛ زمان ارسال فایل تمام شده است. دوباره گزینه دریافت فایل کوکی را بزن.");
    return;
  }

  const document = ctx.message?.document;

  if (!document) {
    await ctx.reply("فایل را به‌صورت Document و با پسوند .txt ارسال کن.");
    return;
  }

  if (!String(document.file_name || "").toLowerCase().endsWith(".txt")) {
    await ctx.reply("❌ فقط فایل .txt پذیرفته می‌شود.");
    return;
  }

  if (
    !Number.isFinite(document.file_size) ||
    document.file_size <= 0 ||
    document.file_size > MAX_COOKIE_BYTES
  ) {
    await ctx.reply("❌ اندازه فایل باید بیشتر از صفر و حداکثر ۱ مگابایت باشد.");
    return;
  }

  try {
    const fileUrl = await ctx.telegram.getFileLink(document.file_id);
    const response = await fetch(fileUrl, {
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) throw new Error("Telegram file download failed");

    const buffer = Buffer.from(await response.arrayBuffer());

    if (!buffer.length || buffer.length > MAX_COOKIE_BYTES) {
      throw new Error("Invalid cookie file size");
    }

    const cookieText = buffer.toString("utf8");

    if (
      !cookieText.includes("instagram.com") ||
      !/(# Netscape HTTP Cookie File|# HTTP Cookie File|\.instagram\.com|\tinstagram\.com\t)/i.test(cookieText)
    ) {
      await ctx.reply(
        "❌ فایل شبیه کوکی اینستاگرام با فرمت Netscape نیست. فایل را دوباره از ابزار خروجی کوکی بگیر."
      );
      return;
    }

    await saveInstagramCookie(cookieText, telegramId);
    pendingUploads.delete(telegramId);

    await ctx.reply(
      "✅ فایل کوکی رمزنگاری و ذخیره شد. اتصال کوکی به دانلود استوری هنوز باید تکمیل شود."
    );
  } catch (error) {
    console.error("Instagram cookie upload failed.");
    await ctx.reply(
      "❌ ذخیره فایل انجام نشد. تنظیم کلید رمزنگاری Render و اتصال دیتابیس را بررسی می‌کنیم."
    );
  }
}

async function removeCookie(ctx) {
  if (!(await isSuperAdmin(ctx))) {
    await ctx.reply("⛔ فقط Super Admin مجاز است.");
    return;
  }

  try {
    await deleteInstagramCookie();
    pendingUploads.delete(ctx.from.id);
    await ctx.reply("✅ کوکی ذخیره‌شده حذف شد.");
  } catch (error) {
    console.error("Instagram cookie deletion failed.");
    await ctx.reply("❌ حذف کوکی انجام نشد.");
  }
}

function createInstagramCookieHandler(bot) {
  bot.hears(COOKIE_BUTTON, showCookieMenu);
  bot.hears("📤 دریافت فایل کوکی", requestCookieUpload);
  bot.hears(DELETE_BUTTON, removeCookie);
  bot.on("document", receiveCookieFile);
}

module.exports = {
  createInstagramCookieHandler,
};
