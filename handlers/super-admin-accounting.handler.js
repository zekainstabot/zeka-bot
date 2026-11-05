const { Markup } = require("telegraf");

const adminService = require("../services/admin.service");

const accountingService = require(
  "../services/super-admin-accounting.service"
);

const expenseFlows = new Map();

const FLOW_TTL = 15 * 60 * 1000;

const EXPENSE_CATEGORIES = [
  "🖥 سرور و هاست",
  "🌐 دامنه و سرویس‌ها",
  "📢 تبلیغات",
  "👨‍💻 توسعه و برنامه‌نویسی",
  "💳 کارمزد و درگاه",
  "📦 سایر هزینه‌ها",
];

const NAVIGATION_BUTTONS = [
  "💰 مالی",
  "💰 درآمدها",
  "💸 هزینه‌ها",
  "📊 گزارش مالی",
  "💳 تراکنش‌ها",
  "💳 مدیریت اعتبار",
  "💎 مدیریت Pro",
  "⭐ درآمد Pro",
  "🎟️ کدهای تخفیف",
  "🔙 بخش مالی",
  "🔙 پنل Super Admin",
  "🔙 پنل ادمین",
  "❌ لغو عملیات",
];

// --------------------------------------------------
// Helpers
// --------------------------------------------------

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

function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (digit) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    )
    .replace(/[٠-٩]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    );
}

function parseAmount(value) {
  const normalized = normalizeDigits(value)
    .replace(/[,\s٬،]/g, "")
    .trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);

  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    return null;
  }

  return amount;
}

function formatAmount(amount, currency = "IRT") {
  const formatted = new Intl.NumberFormat(
    "en-US",
    {
      maximumFractionDigits: 2,
    }
  ).format(Number(amount || 0));

  const currencyLabel =
    currency === "IRR"
      ? "ریال"
      : currency === "IRT"
        ? "تومان"
        : currency;

  return `${formatted} ${currencyLabel}`;
}

function formatDate(value) {
  if (!value) {
    return "ثبت نشده";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "نامشخص";
  }

  return date.toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getPeriodLabel(period) {
  const labels = {
    today: "امروز",
    month: "ماه جاری",
    all: "کل دوره",
  };

  return labels[period] || "نامشخص";
}

function getExpenseState(telegramUserId) {
  const state = expenseFlows.get(telegramUserId);

  if (!state) {
    return null;
  }

  if (
    !state.updatedAt ||
    Date.now() - state.updatedAt > FLOW_TTL
  ) {
    expenseFlows.delete(telegramUserId);
    return null;
  }

  return state;
}

function setExpenseState(telegramUserId, state) {
  expenseFlows.set(telegramUserId, {
    ...state,
    updatedAt: Date.now(),
  });
}

function clearExpenseState(telegramUserId) {
  expenseFlows.delete(telegramUserId);
}

// --------------------------------------------------
// Keyboards
// --------------------------------------------------

function buildFinanceKeyboard() {
  return Markup.keyboard([
    ["💰 درآمدها", "💸 هزینه‌ها"],
    ["📊 گزارش مالی"],
    ["🔙 بخش مالی"],
  ])
    .resize()
    .oneTime(false);
}

function buildExpenseKeyboard() {
  return Markup.keyboard([
    ["➕ ثبت هزینه"],
    ["📋 هزینه‌های اخیر"],
    ["🔙 بخش مالی"],
  ])
    .resize()
    .oneTime(false);
}

function buildPeriodKeyboard() {
  return Markup.keyboard([
    ["📅 گزارش امروز"],
    ["🗓 گزارش ماه جاری"],
    ["📚 گزارش کل دوره"],
    ["🔙 بخش مالی"],
  ])
    .resize()
    .oneTime(false);
}

// --------------------------------------------------
// Income report
// --------------------------------------------------

async function handleIncome(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply("⛔ دسترسی غیرمجاز.");
    return;
  }

  try {
    const reports = await accountingService.getFinanceReport(
      "all"
    );

    let message =
      "💰 گزارش درآمدهای زکا\n\n";

    if (!reports.length) {
      message += "هنوز درآمدی ثبت نشده است.";
    } else {
      for (const item of reports) {
        message +=
          `💵 ارز: ${item.currency}\n` +
          `💰 درآمد کل: ${formatAmount(
            item.totalIncome,
            item.currency
          )}\n` +
          `🧾 تعداد درآمدها: ${item.incomeCount}\n\n`;
      }
    }

    message +=
      "━━━━━━━━━━━━━━\n" +
      "منابع درآمد:\n" +
      "• اشتراک‌های Pro تأییدشده\n" +
      "• پرداخت‌های موفق خرید اعتبار\n\n" +
      "پرداخت‌های ناموفق و درخواست‌های تأییدنشده محاسبه نمی‌شوند.";

    await ctx.reply(
      message,
      buildFinanceKeyboard()
    );
  } catch (error) {
    console.error("Finance income report failed:", error);

    await ctx.reply(
      "❌ دریافت گزارش درآمد انجام نشد.",
      buildFinanceKeyboard()
    );
  }
}

// --------------------------------------------------
// Expenses menu
// --------------------------------------------------

async function handleExpenses(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply("⛔ دسترسی غیرمجاز.");
    return;
  }

  clearExpenseState(ctx.from.id);

  try {
    const reports = await accountingService.getFinanceReport(
      "all"
    );

    const total = reports.reduce(
      (sum, item) =>
        item.currency === "IRT"
          ? sum + item.totalExpenses
          : sum,
      0
    );

    await ctx.reply(
      "💸 مدیریت هزینه‌های زکا\n\n" +
        `📊 مجموع هزینه‌های ثبت‌شده: ${formatAmount(total)}\n\n` +
        "برای ثبت هزینه جدید، گزینه ثبت هزینه را انتخاب کن.\n" +
        "هزینه‌ها فقط پس از تأیید ثبت می‌شوند.",
      buildExpenseKeyboard()
    );
  } catch (error) {
    console.error("Finance expenses menu failed:", error);

    await ctx.reply(
      "❌ دریافت اطلاعات هزینه‌ها انجام نشد.",
      buildFinanceKeyboard()
    );
  }
}

// --------------------------------------------------
// Latest expenses
// --------------------------------------------------

async function handleLatestExpenses(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply("⛔ دسترسی غیرمجاز.");
    return;
  }

  try {
    const expenses = await accountingService.getLatestExpenses(
      15
    );

    if (!expenses.length) {
      await ctx.reply(
        "📋 هنوز هزینه‌ای ثبت نشده است.",
        buildExpenseKeyboard()
      );

      return;
    }

    const lines = expenses.map((item, index) => {
      return (
        `${index + 1}. 💸 ${item.description}\n` +
        `🏷 دسته‌بندی: ${item.category}\n` +
        `💰 مبلغ: ${formatAmount(
          item.amount,
          item.currency
        )}\n` +
        `🆔 ثبت‌کننده: ${item.created_by_telegram_id}\n` +
        `📅 تاریخ: ${formatDate(item.created_at)}`
      );
    });

    await ctx.reply(
      "📋 آخرین هزینه‌های ثبت‌شده\n\n" +
        lines.join("\n\n━━━━━━━━━━━━━━\n\n"),
      buildExpenseKeyboard()
    );
  } catch (error) {
    console.error("Latest expenses failed:", error);

    await ctx.reply(
      "❌ دریافت فهرست هزینه‌ها انجام نشد.",
      buildExpenseKeyboard()
    );
  }
}

// --------------------------------------------------
// Add expense flow
// --------------------------------------------------

async function handleCreateExpense(ctx) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply("⛔ دسترسی غیرمجاز.");
    return;
  }

  setExpenseState(ctx.from.id, {
    step: "category",
    category: null,
    description: null,
    amount: null,
  });

  const rows = EXPENSE_CATEGORIES.map(
    (category) => [category]
  );

  rows.push(["❌ لغو ثبت هزینه"]);

  await ctx.reply(
    "➕ ثبت هزینه جدید\n\n" +
      "ابتدا دسته‌بندی هزینه را انتخاب کن.",
    Markup.keyboard(rows)
      .resize()
      .oneTime(false)
  );
}

// --------------------------------------------------
// Finance report
// --------------------------------------------------

async function showFinanceReport(ctx, period) {
  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    await ctx.reply("⛔ دسترسی غیرمجاز.");
    return;
  }

  try {
    const reports = await accountingService.getFinanceReport(
      period
    );

    let message =
      "📊 گزارش مالی زکا\n" +
      `📅 بازه: ${getPeriodLabel(period)}\n\n`;

    if (!reports.length) {
      message += "در این بازه درآمد یا هزینه‌ای ثبت نشده است.";
    } else {
      for (const item of reports) {
        message +=
          `💱 واحد پول: ${item.currency}\n` +
          `💰 درآمد: ${formatAmount(
            item.totalIncome,
            item.currency
          )}\n` +
          `💸 هزینه: ${formatAmount(
            item.totalExpenses,
            item.currency
          )}\n` +
          `📈 سود خالص: ${formatAmount(
            item.netProfit,
            item.currency
          )}\n\n` +
          `🧾 تعداد درآمدها: ${item.incomeCount}\n` +
          `📋 تعداد هزینه‌ها: ${item.expenseCount}\n\n` +
          "━━━━━━━━━━━━━━\n\n";
      }
    }

    message +=
      "سود خالص = درآمد ثبت‌شده - هزینه ثبت‌شده\n" +
      "ارزهای مختلف با یکدیگر جمع نمی‌شوند.";

    await ctx.reply(
      message,
      buildPeriodKeyboard()
    );
  } catch (error) {
    console.error("Finance report failed:", error);

    await ctx.reply(
      "❌ دریافت گزارش مالی انجام نشد.",
      buildFinanceKeyboard()
    );
  }
}

// --------------------------------------------------
// Expense text flow
// --------------------------------------------------

async function handleExpenseInput(ctx, next) {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return next();
  }

  const state = getExpenseState(telegramUserId);

  if (!state) {
    return next();
  }

  const text = String(
    ctx.message?.text || ""
  ).trim();

  if (!text) {
    return next();
  }

  if (text.startsWith("/")) {
    clearExpenseState(telegramUserId);
    return next();
  }

  if (
    text === "❌ لغو ثبت هزینه" ||
    text === "❌ لغو عملیات"
  ) {
    clearExpenseState(telegramUserId);

    await ctx.reply(
      "ثبت هزینه لغو شد.",
      buildExpenseKeyboard()
    );

    return;
  }

  if (NAVIGATION_BUTTONS.includes(text)) {
    clearExpenseState(telegramUserId);
    return next();
  }

  const admin = await getSuperAdmin(ctx);

  if (!admin) {
    clearExpenseState(telegramUserId);

    await ctx.reply("⛔ دسترسی غیرمجاز.");

    return;
  }

  // انتخاب دسته‌بندی
  if (state.step === "category") {
    if (!EXPENSE_CATEGORIES.includes(text)) {
      await ctx.reply(
        "❌ یک دسته‌بندی معتبر از دکمه‌ها انتخاب کن."
      );

      return;
    }

    state.category = text.replace(
      /^[^\p{L}\p{N}]+\s*/u,
      ""
    );

    state.step = "description";

    setExpenseState(telegramUserId, state);

    await ctx.reply(
      "📝 توضیح هزینه را وارد کن.\n\n" +
        "مثال: پرداخت هزینه سرور ماه آبان"
    );

    return;
  }

  // توضیحات
  if (state.step === "description") {
    if (text.length < 3 || text.length > 500) {
      await ctx.reply(
        "❌ توضیح باید بین ۳ تا ۵۰۰ کاراکتر باشد."
      );

      return;
    }

    state.description = text;
    state.step = "amount";

    setExpenseState(telegramUserId, state);

    await ctx.reply(
      "💰 مبلغ هزینه را به تومان وارد کن.\n\n" +
        "مثال: 250000"
    );

    return;
  }

  // مبلغ
  if (state.step === "amount") {
    const amount = parseAmount(text);

    if (amount === null) {
      await ctx.reply(
        "❌ مبلغ معتبر نیست.\n" +
          "فقط عدد صحیح مثبت وارد کن."
      );

      return;
    }

    state.amount = amount;
    state.step = "confirm";

    setExpenseState(telegramUserId, state);

    await ctx.reply(
      "🔎 تأیید اطلاعات هزینه\n\n" +
        `🏷 دسته‌بندی: ${state.category}\n` +
        `📝 توضیح: ${state.description}\n` +
        `💰 مبلغ: ${formatAmount(state.amount)}\n\n` +
        "آیا این هزینه ثبت شود؟",
      Markup.keyboard([
        ["✅ تأیید ثبت هزینه"],
        ["❌ لغو ثبت هزینه"],
      ])
        .resize()
        .oneTime(false)
    );

    return;
  }

  // تأیید نهایی
  if (state.step === "confirm") {
    if (text !== "✅ تأیید ثبت هزینه") {
      await ctx.reply(
        "برای ثبت هزینه، تأیید را بزن یا عملیات را لغو کن."
      );

      return;
    }

    try {
      const expense = await accountingService.createExpense({
        category: state.category,
        description: state.description,
        amount: state.amount,
        createdByTelegramId: telegramUserId,
      });

      clearExpenseState(telegramUserId);

      await ctx.reply(
        "✅ هزینه با موفقیت ثبت شد.\n\n" +
          `🆔 شماره ثبت: ${expense.id}\n` +
          `🏷 دسته‌بندی: ${expense.category}\n` +
          `📝 توضیح: ${expense.description}\n` +
          `💰 مبلغ: ${formatAmount(expense.amount, expense.currency)}\n` +
          `📅 تاریخ: ${formatDate(expense.created_at)}`,
        buildExpenseKeyboard()
      );
    } catch (error) {
      console.error("Expense creation failed:", error);

      clearExpenseState(telegramUserId);

      await ctx.reply(
        "❌ ثبت هزینه انجام نشد. اطلاعات دیتابیس را بررسی کن.",
        buildExpenseKeyboard()
      );
    }
  }
}

// --------------------------------------------------
// Register handlers
// --------------------------------------------------

function createSuperAdminAccountingHandler(bot) {
  bot.on(
    "text",
    handleExpenseInput
  );

  bot.hears(
    "💰 درآمدها",
    handleIncome
  );

  bot.hears(
    "💸 هزینه‌ها",
    handleExpenses
  );

  bot.hears(
    "➕ ثبت هزینه",
    handleCreateExpense
  );

  bot.hears(
    "📋 هزینه‌های اخیر",
    handleLatestExpenses
  );

  bot.hears(
    "📊 گزارش مالی",
    (ctx) => showFinanceReport(ctx, "all")
  );

  bot.hears(
    "📅 گزارش امروز",
    (ctx) => showFinanceReport(ctx, "today")
  );

  bot.hears(
    "🗓 گزارش ماه جاری",
    (ctx) => showFinanceReport(ctx, "month")
  );

  bot.hears(
    "📚 گزارش کل دوره",
    (ctx) => showFinanceReport(ctx, "all")
  );
}

module.exports = {
  createSuperAdminAccountingHandler,
};
