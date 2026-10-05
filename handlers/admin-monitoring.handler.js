const adminService = require("../services/admin.service");
const monitoringService = require("../services/monitoring.service");

const PERMISSION = "monitoring";

function buildMonitoringMenu() {
return [
["🔄 بروزرسانی مانیتورینگ"],
["🔙 پنل ادمین"],
];
}

function formatUptime(seconds) {
const totalSeconds = Math.max(
0,
Math.floor(Number(seconds) || 0)
);

const days = Math.floor(totalSeconds / 86400);
const hours = Math.floor((totalSeconds % 86400) / 3600);
const minutes = Math.floor((totalSeconds % 3600) / 60);

if (days > 0) {
return String(days) + " روز و " + String(hours) + " ساعت";
}

if (hours > 0) {
return String(hours) + " ساعت و " + String(minutes) + " دقیقه";
}

return String(minutes) + " دقیقه";
}

async function getAuthorizedAdmin(ctx) {
const telegramUserId = ctx.from?.id;

if (!telegramUserId) {
return null;
}

const admin = await adminService.getAdminByTelegramId(
telegramUserId
);

if (!admin || !admin.is_active) {
return null;
}

const allowed = await adminService.hasPermission(
admin.user_id,
PERMISSION
);

if (!allowed) {
return null;
}

return admin;
}

async function showMonitoring(ctx) {
try {
const admin = await getAuthorizedAdmin(ctx);

if (!admin) {
  await ctx.reply(
    "⛔ شما به بخش مانیتورینگ دسترسی ندارید."
  );
  return;
}

const data =
  await monitoringService.getMonitoringData();

const uptime = formatUptime(
  data.uptimeSeconds
);

const message = [
  "📊 مانیتورینگ ربات",
  "",
  "🤖 وضعیت ربات: 🟢 فعال",
  `⏱ زمان فعالیت: ${uptime}`,
  `🗄 دیتابیس: ${data.database}`,
  "",
  "👥 کاربران",
  `• کل کاربران: ${data.users}`,
  `• کاربران فعال ۲۴ ساعت اخیر: ${data.activeUsers}`,
  "",
  "📥 درخواست‌ها",
  `• کل درخواست‌ها: ${data.requests}`,
  `• در انتظار: ${data.waitingJobs}`,
  `• در حال پردازش: ${data.processingJobs}`,
  `• ناموفق: ${data.failedJobs}`,
  `• تکمیل‌شده: ${data.completedJobs}`,
  "",
  "⚙️ Queue",
  `• صف داخلی: ${data.queueWaiting}`,
  `• پردازش فعال: ${data.queueActive}`,
  `• ظرفیت همزمان: ${data.queueCapacity}`,
  `• ظرفیت آزاد: ${data.queueFree}`,
].join("\n");

await ctx.reply(message, {
  reply_markup: {
    keyboard: buildMonitoringMenu(),
    resize_keyboard: true,
    one_time_keyboard: false,
  },
});

} catch (error) {
console.error(
"ADMIN MONITORING ERROR:",
error
);

await ctx.reply(
  "❌ دریافت اطلاعات مانیتورینگ انجام نشد."
);

}
}

async function handleMonitoringRefresh(ctx) {
await showMonitoring(ctx);
}

function createAdminMonitoringHandler(bot) {
bot.hears(
"📊 مانیتورینگ",
showMonitoring
);

bot.hears(
"🔄 بروزرسانی مانیتورینگ",
handleMonitoringRefresh
);
}

module.exports = {
createAdminMonitoringHandler,
showMonitoring,
};
