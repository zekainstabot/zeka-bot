
const adminService = require("../services/admin.service");
const supportRepository = require("../repositories/support.repository");

const PERMISSION = "support";
const MENU_BUTTON = "💬 مدیریت پشتیبانی";

const pendingReplies = new Map();

const STATUS_LABELS = {
  OPEN: "🆕 جدید",
  IN_PROGRESS: "🔄 در حال بررسی",
  WAITING_USER: "⏳ منتظر پاسخ کاربر",
  RESOLVED: "✅ حل‌شده",
  CLOSED: "🔒 بسته‌شده",
};

const STATUS_BUTTONS = [
  { status: "OPEN", label: "📩 تیکت‌های جدید" },
  { status: "IN_PROGRESS", label: "🔄 در حال بررسی" },
  { status: "WAITING_USER", label: "⏳ منتظر پاسخ کاربر" },
  { status: "RESOLVED", label: "✅ تیکت‌های حل‌شده" },
  { status: "CLOSED", label: "🔒 تیکت‌های بسته‌شده" },
];

function keyboard(rows) {
  return {
    reply_markup: {
      keyboard: rows,
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

function inlineKeyboard(rows) {
  return {
    reply_markup: {
      inline_keyboard: rows,
    },
  };
}

function formatDate(value) {
  if (!value) return "نامشخص";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "نامشخص";
  }

  return date.toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
  });
}

function getUserName(ticket) {
  if (ticket.display_name) {
    return ticket.display_name;
  }

  if (ticket.username) {
    return `@${ticket.username}`;
  }

  return ticket.telegram_user_id || "نامشخص";
}

async function getAuthorizedAdmin(ctx) {
  const telegramId = ctx.from?.id;

  if (!telegramId) return null;

  const admin = await adminService.getAdminByTelegramId(
    telegramId
  );

  if (!admin || !admin.is_active) {
    return null;
  }

  const allowed = await adminService.hasPermission(
    admin.user_id,
    PERMISSION
  );

  if (!allowed) return null;

  return admin;
}

async function requireAdmin(ctx) {
  const admin = await getAuthorizedAdmin(ctx);

  if (!admin) {
    await ctx.reply(
      "⛔ شما اجازه مدیریت تیکت‌های پشتیبانی را ندارید."
    );

    return null;
  }

  return admin;
}

async function showSupportMenu(ctx) {
  const admin = await requireAdmin(ctx);

  if (!admin) return;

  await ctx.reply(
    "🆘 مدیریت پشتیبانی\n\n" +
      "بخش موردنظر را انتخاب کن:",
    keyboard([
      ["📩 تیکت‌های جدید", "🔄 در حال بررسی"],
      ["⏳ منتظر پاسخ کاربر", "✅ تیکت‌های حل‌شده"],
      ["🔒 تیکت‌های بسته‌شده", "📊 آمار پشتیبانی"],
      ["🔙 بازگشت به پشتیبانی"],
    ])
  );
}

async function showTicketList(ctx, status, offset = 0) {
  const admin = await requireAdmin(ctx);

  if (!admin) return;

  const tickets = await supportRepository.listTickets({
    status,
    limit: 10,
    offset,
  });

  if (!tickets.length) {
    await ctx.reply(
      `📭 ${STATUS_LABELS[status] || "تیکت‌ها"}\n\n` +
        "تیکتی در این بخش وجود ندارد."
    );

    return;
  }

  const rows = tickets.map((ticket) => {
    const subject = ticket.subject || "بدون عنوان";
    const userName = getUserName(ticket);

    return [{
      text:
        `#${ticket.ticket_id} | ${subject.slice(0, 35)}\n` +
        `👤 ${userName}`,
      callback_data: `support:ticket:${ticket.id}`,
    }];
  });

  const navigation = [];

  if (offset > 0) {
    navigation.push({
      text: "⬅️ قبلی",
      callback_data: `support:list:${status}:${Math.max(
        0,
        offset - 10
      )}`,
    });
  }

  if (tickets.length === 10) {
    navigation.push({
      text: "بعدی ➡️",
      callback_data: `support:list:${status}:${offset + 10}`,
    });
  }

  if (navigation.length) {
    rows.push(navigation);
  }

  await ctx.reply(
    `${STATUS_LABELS[status] || "📩 تیکت‌ها"}\n\n` +
      `تعداد نمایش داده‌شده: ${tickets.length}`,
    inlineKeyboard(rows)
  );
}

async function showTicketDetails(ctx, ticketId) {
  const admin = await requireAdmin(ctx);

  if (!admin) return;

  const ticket = await supportRepository.findTicketById(
    ticketId
  );

  if (!ticket) {
    await ctx.reply("❌ تیکت پیدا نشد.");
    return;
  }

  const text =
    "📩 جزئیات تیکت\n\n" +
    `🆔 کد: ${ticket.ticket_id}\n` +
    `👤 کاربر: ${getUserName(ticket)}\n` +
    `📱 آیدی تلگرام: ${ticket.telegram_user_id}\n` +
    `📌 موضوع: ${ticket.subject || "بدون عنوان"}\n` +
    `📂 دسته‌بندی: ${ticket.category || "OTHER"}\n` +
    `⚡ اولویت: ${ticket.priority || "NORMAL"}\n` +
    `📊 وضعیت: ${STATUS_LABELS[ticket.status] || ticket.status}\n` +
    `📨 تعداد پیام‌ها: ${ticket.message_count || 0}\n` +
    `📅 تاریخ ثبت: ${formatDate(ticket.created_at)}\n` +
    `🕒 آخرین پیام: ${formatDate(ticket.last_message_at)}`;

  const rows = [
    [
      {
        text: "💬 مشاهده پیام‌ها",
        callback_data: `support:messages:${ticket.id}`,
      },
      {
        text: "✉️ پاسخ به کاربر",
        callback_data: `support:reply:${ticket.id}`,
      },
    ],
    [
      {
        text: "👤 تخصیص به من",
        callback_data: `support:assign:${ticket.id}`,
      },
    ],
  ];

  if (ticket.status === "OPEN") {
    rows.push([
      {
        text: "🔄 شروع بررسی",
        callback_data: `support:status:${ticket.id}:IN_PROGRESS`,
      },
    ]);
  }

  if (
    ticket.status === "OPEN" ||
    ticket.status === "IN_PROGRESS" ||
    ticket.status === "WAITING_USER"
  ) {
    rows.push([
      {
        text: "✅ حل شد",
        callback_data: `support:status:${ticket.id}:RESOLVED`,
      },
      {
        text: "🔒 بستن تیکت",
        callback_data: `support:status:${ticket.id}:CLOSED`,
      },
    ]);
  }

  if (
    ticket.status === "RESOLVED" ||
    ticket.status === "CLOSED"
  ) {
    rows.push([
      {
        text: "🔓 بازگشایی تیکت",
        callback_data: `support:status:${ticket.id}:OPEN`,
      },
    ]);
  }

  rows.push([
    {
      text: "🗑 حذف تیکت",
      callback_data: `support:delete_confirm:${ticket.id}`,
    },
  ]);

  await ctx.reply(text, inlineKeyboard(rows));
}

async function showTicketMessages(ctx, ticketId) {
  const admin = await requireAdmin(ctx);

  if (!admin) return;

  const ticket = await supportRepository.findTicketById(
    ticketId
  );

  if (!ticket) {
    await ctx.reply("❌ تیکت پیدا نشد.");
    return;
  }

  const messages = await supportRepository.getTicketMessages(
    ticketId,
    { limit: 100 }
  );

  if (!messages.length) {
    await ctx.reply("📭 هیچ پیامی برای این تیکت ثبت نشده است.");
    return;
  }

  const lines = messages.map((message, index) => {
    let sender = "👤 کاربر";

    if (message.sender_type === "ADMIN") {
      sender = "🛠 پشتیبانی";
    } else if (message.sender_type === "SYSTEM") {
      sender = "⚙️ سیستم";
    }

    return (
      `${index + 1}. ${sender}\n` +
      `🕒 ${formatDate(message.created_at)}\n\n` +
      `${message.message}`
    );
  });

  await ctx.reply(
    `💬 تاریخچه تیکت ${ticket.ticket_id}\n\n` +
      lines.join("\n\n━━━━━━━━━━━━\n\n")
  );
}

async function startReply(ctx, ticketId) {
  const admin = await requireAdmin(ctx);

  if (!admin) return;

  const ticket = await supportRepository.findTicketById(
    ticketId
  );

  if (!ticket) {
    await ctx.reply("❌ تیکت پیدا نشد.");
    return;
  }

  if (ticket.status === "CLOSED") {
    await ctx.reply(
      "🔒 این تیکت بسته شده است. ابتدا آن را بازگشایی کن."
    );
    return;
  }

  pendingReplies.set(String(ctx.from.id), {
    ticketId: ticket.id,
    adminUserId: admin.user_id,
    telegramUserId: ticket.telegram_user_id,
    ticketCode: ticket.ticket_id,
  });

  await ctx.reply(
    `✉️ پاسخ به تیکت ${ticket.ticket_id}\n\n` +
      "پیام خود را ارسال کن.\n\n" +
      "برای لغو، دکمه لغو را بزن.",
    keyboard([
      ["❌ لغو پاسخ"],
    ])
  );
}

async function handleAdminReply(ctx, next) {
  const telegramId = String(ctx.from?.id || "");
  const pending = pendingReplies.get(telegramId);

  if (!pending) {
    return next();
  }

  const message = String(ctx.message?.text || "").trim();

  if (!message) {
    await ctx.reply("❌ متن پاسخ نمی‌تواند خالی باشد.");
    return;
  }

  if (message === "❌ لغو پاسخ") {
    pendingReplies.delete(telegramId);

    await ctx.reply(
      "عملیات پاسخ لغو شد.",
      keyboard([
        ["🆘 پشتیبانی"],
        ["🔙 پنل ادمین"],
      ])
    );

    return;
  }

  try {
    const ticket = await supportRepository.findTicketById(
      pending.ticketId
    );

    if (!ticket) {
      pendingReplies.delete(telegramId);
      await ctx.reply("❌ تیکت دیگر وجود ندارد.");
      return;
    }

    await supportRepository.addMessage({
      ticketId: pending.ticketId,
      senderUserId: pending.adminUserId,
      senderType: "ADMIN",
      message,
    });

    await supportRepository.updateTicketStatus(
      pending.ticketId,
      "WAITING_USER"
    );

    let notificationSent = true;

    try {
      await ctx.telegram.sendMessage(
        pending.telegramUserId,
        "📩 پاسخ جدید از پشتیبانی\n\n" +
          `🆔 تیکت: ${pending.ticketCode}\n\n` +
          `${message}\n\n` +
          "برای ادامه گفتگو از بخش پشتیبانی اقدام کن."
      );
    } catch (error) {
      notificationSent = false;

      console.error(
        "Support reply notification failed:",
        error.message
      );
    }

    pendingReplies.delete(telegramId);

    await ctx.reply(
      "✅ پاسخ در تیکت ثبت شد.\n\n" +
        (notificationSent
          ? "📨 پیام برای کاربر ارسال شد."
          : "⚠️ پیام ثبت شد اما ارسال اعلان به کاربر ناموفق بود.")
    );
  } catch (error) {
    console.error("Admin support reply failed:", error);

    await ctx.reply(
      "❌ ثبت پاسخ انجام نشد. دوباره تلاش کن."
    );
  }
}

async function changeTicketStatus(ctx, ticketId, status) {
  const admin = await requireAdmin(ctx);

  if (!admin) return;

  const ticket = await supportRepository.updateTicketStatus(
    ticketId,
    status
  );

  if (!ticket) {
    await ctx.reply("❌ تیکت پیدا نشد.");
    return;
  }

  await ctx.reply(
    `✅ وضعیت تیکت به «${STATUS_LABELS[status] || status}» تغییر کرد.`
  );

  await showTicketDetails(ctx, ticketId);
}

async function assignTicketToAdmin(ctx, ticketId) {
  const admin = await requireAdmin(ctx);

  if (!admin) return;

  const ticket = await supportRepository.assignTicket(
    ticketId,
    admin.user_id
  );

  if (!ticket) {
    await ctx.reply("❌ تیکت پیدا نشد.");
    return;
  }

  await ctx.reply("✅ تیکت به شما تخصیص داده شد.");
  await showTicketDetails(ctx, ticketId);
}

async function confirmDeleteTicket(ctx, ticketId) {
  const admin = await requireAdmin(ctx);

  if (!admin) return;

  const ticket = await supportRepository.findTicketById(
    ticketId
  );

  if (!ticket) {
    await ctx.reply("❌ تیکت پیدا نشد.");
    return;
  }

  await ctx.reply(
    `⚠️ آیا از حذف دائمی تیکت ${ticket.ticket_id} مطمئن هستی؟\n\n` +
      "تمام پیام‌های این تیکت نیز حذف خواهند شد.",
    inlineKeyboard([
      [
        {
          text: "🗑 بله، حذف شود",
          callback_data: `support:delete:${ticket.id}`,
        },
        {
          text: "❌ انصراف",
          callback_data: `support:ticket:${ticket.id}`,
        },
      ],
    ])
  );
}

async function deleteTicket(ctx, ticketId) {
  const admin = await requireAdmin(ctx);

  if (!admin) return;

  const deleted = await supportRepository.deleteTicket(
    ticketId
  );

  if (!deleted) {
    await ctx.reply("❌ تیکت پیدا نشد یا قبلاً حذف شده است.");
    return;
  }

  await ctx.reply(
    `✅ تیکت ${deleted.ticket_id} حذف شد.`
  );
}

async function showSupportStats(ctx) {
  const admin = await requireAdmin(ctx);

  if (!admin) return;

  const stats = await supportRepository.getTicketStats();

  await ctx.reply(
    "📊 آمار پشتیبانی\n\n" +
      `📨 کل تیکت‌ها: ${stats.total}\n` +
      `🆕 جدید: ${stats.open}\n` +
      `🔄 در حال بررسی: ${stats.in_progress}\n` +
      `⏳ منتظر پاسخ کاربر: ${stats.waiting_user}\n` +
      `✅ حل‌شده: ${stats.resolved}\n` +
      `🔒 بسته‌شده: ${stats.closed}`
  );
}

function createAdminSupportHandler(bot) {
  bot.hears(MENU_BUTTON, showSupportMenu);

  bot.hears("📩 تیکت‌های جدید", (ctx) =>
    showTicketList(ctx, "OPEN")
  );

  bot.hears("🔄 در حال بررسی", (ctx) =>
    showTicketList(ctx, "IN_PROGRESS")
  );

  bot.hears("⏳ منتظر پاسخ کاربر", (ctx) =>
    showTicketList(ctx, "WAITING_USER")
  );

  bot.hears("✅ تیکت‌های حل‌شده", (ctx) =>
    showTicketList(ctx, "RESOLVED")
  );

  bot.hears("🔒 تیکت‌های بسته‌شده", (ctx) =>
    showTicketList(ctx, "CLOSED")
  );

  bot.hears("📊 آمار پشتیبانی", showSupportStats);

  bot.hears("🔙 بازگشت به پشتیبانی", async (ctx) => {
    await ctx.reply(
      "برای بازگشت، دکمه پشتیبانی را انتخاب کن.",
      keyboard([
        ["🆘 پشتیبانی"],
        ["🔙 پنل ادمین"],
      ])
    );
  });

  bot.hears("❌ لغو پاسخ", async (ctx) => {
    const telegramId = String(ctx.from?.id || "");

    if (pendingReplies.has(telegramId)) {
      pendingReplies.delete(telegramId);
    }

    await ctx.reply(
      "عملیات پاسخ لغو شد.",
      keyboard([
        ["🆘 پشتیبانی"],
        ["🔙 پنل ادمین"],
      ])
    );
  });

  bot.action(/^support:list:([A-Z_]+):(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();

      await showTicketList(
        ctx,
        ctx.match[1],
        Number(ctx.match[2])
      );
    } catch (error) {
      console.error("Support ticket list failed:", error);
      await ctx.reply("❌ دریافت فهرست تیکت‌ها ناموفق بود.");
    }
  });

  bot.action(/^support:ticket:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await showTicketDetails(ctx, Number(ctx.match[1]));
    } catch (error) {
      console.error("Support ticket details failed:", error);
      await ctx.reply("❌ دریافت اطلاعات تیکت ناموفق بود.");
    }
  });

  bot.action(/^support:messages:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await showTicketMessages(ctx, Number(ctx.match[1]));
    } catch (error) {
      console.error("Support messages failed:", error);
      await ctx.reply("❌ دریافت پیام‌ها ناموفق بود.");
    }
  });

  bot.action(/^support:reply:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await startReply(ctx, Number(ctx.match[1]));
    } catch (error) {
      console.error("Support reply start failed:", error);
      await ctx.reply("❌ شروع پاسخ‌گویی ناموفق بود.");
    }
  });

  bot.action(
    /^support:status:(\d+):(OPEN|IN_PROGRESS|WAITING_USER|RESOLVED|CLOSED)$/,
    async (ctx) => {
      try {
        await ctx.answerCbQuery();

        await changeTicketStatus(
          ctx,
          Number(ctx.match[1]),
          ctx.match[2]
        );
      } catch (error) {
        console.error("Support status update failed:", error);
        await ctx.reply("❌ تغییر وضعیت تیکت ناموفق بود.");
      }
    }
  );

  bot.action(/^support:assign:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await assignTicketToAdmin(ctx, Number(ctx.match[1]));
    } catch (error) {
      console.error("Support assignment failed:", error);
      await ctx.reply("❌ تخصیص تیکت ناموفق بود.");
    }
  });

  bot.action(/^support:delete_confirm:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await confirmDeleteTicket(ctx, Number(ctx.match[1]));
    } catch (error) {
      console.error("Support delete confirmation failed:", error);
      await ctx.reply("❌ انجام عملیات ناموفق بود.");
    }
  });

  bot.action(/^support:delete:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await deleteTicket(ctx, Number(ctx.match[1]));
    } catch (error) {
      console.error("Support ticket deletion failed:", error);
      await ctx.reply("❌ حذف تیکت ناموفق بود.");
    }
  });

  bot.on("text", handleAdminReply);
}

module.exports = {
  createAdminSupportHandler,
  showSupportMenu,
};
