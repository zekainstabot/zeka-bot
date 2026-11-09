const ERROR_MESSAGES = {
  DOWNLOAD_TIMEOUT: "دانلود زمان‌بر شد و پس از پایان مهلت متوقف شد. لطفاً کمی بعد دوباره تلاش کنید.",
  INSTAGRAM_IP_BLOCKED: "دسترسی IP سرور به اینستاگرام موقتاً محدود شده است. لطفاً بعداً دوباره تلاش کنید.",
  INSTAGRAM_RATE_LIMITED: "اینستاگرام تعداد درخواست‌های سرور را محدود کرده است. کمی بعد دوباره تلاش کنید.",
  INVALID_INSTAGRAM_URL: "لینک واردشده معتبر نیست یا ساختار آن اشتباه است.",
  INSTAGRAM_CONTENT_NOT_FOUND: "محتوای این لینک پیدا نشد؛ ممکن است حذف شده یا لینک اشتباه باشد.",
  INSTAGRAM_PRIVATE_CONTENT: "این محتوا خصوصی است و امکان دانلود آن وجود ندارد.",
  INSTAGRAM_LOGIN_REQUIRED: "برای دسترسی به این محتوا، ورود به حساب اینستاگرام لازم است.",
  INSTAGRAM_UNAVAILABLE: "این محتوا در حال حاضر از سمت اینستاگرام در دسترس نیست.",
  INSTAGRAM_DOWNLOAD_FAILED: "دانلود از اینستاگرام انجام نشد. لطفاً لینک را بررسی و دوباره تلاش کنید.",
  WORKER_ERROR: "در پردازش دانلود خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.",
};

function classifyDownloadError(error) {
  if (error?.code && ERROR_MESSAGES[error.code]) return error.code;

  const text = [
    error?.message,
    error?.stderr,
    error?.stdout,
    error?.shortMessage,
  ].filter(Boolean).join(" ").toLowerCase();

  if (error?.code === "DOWNLOAD_TIMEOUT" || /timed?\\s*out|timeout|etimedout/.test(text)) return "DOWNLOAD_TIMEOUT";
  if (/429|too many requests|rate.?limit|please wait a few minutes/.test(text)) return "INSTAGRAM_RATE_LIMITED";
  if (/ip.{0,30}(block|restrict|limit)|blocked.{0,30}ip|your ip address|request.{0,20}blocked|feedback_required/.test(text)) return "INSTAGRAM_IP_BLOCKED";
  if (/private video|private account|this account is private|not authorized to view|content is private/.test(text)) return "INSTAGRAM_PRIVATE_CONTENT";
  if (/login required|cookies are needed|authentication required|please log in|sign in to confirm|not logged in/.test(text)) return "INSTAGRAM_LOGIN_REQUIRED";
  if (/404|not found|media not found|post not found|does not exist|page isn't available|page not available/.test(text)) return "INSTAGRAM_CONTENT_NOT_FOUND";
  if (/invalid url|unsupported url|unable to extract|shortcode.*(invalid|could not)|instagram url.*invalid/.test(text)) return "INVALID_INSTAGRAM_URL";
  if (/403|forbidden|unavailable|temporarily unavailable|challenge_required/.test(text)) return "INSTAGRAM_UNAVAILABLE";
  return "INSTAGRAM_DOWNLOAD_FAILED";
}

function getDownloadErrorMessage(code) {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.INSTAGRAM_DOWNLOAD_FAILED;
}

module.exports = { classifyDownloadError, getDownloadErrorMessage };
