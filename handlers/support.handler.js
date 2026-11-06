
const { Markup } = require("telegraf");

const supportRepository = require("../repositories/support.repository");
const userService = require("../services/user.service");

const SUPPORT_BUTTON = "💬 ارتباط با پشتیبانی";
const NEW_TICKET_BUTTON = "➕ ثبت تیکت جدید";
const MY_TICKETS_BUTTON = "📨 تیکت‌های من";
const REPLY_TICKET_BUTTON = "✉️ پیام به تیکت فعال";
const CANCEL_BUTTON = "❌ لغو";

const pendingActions = new Map();

function buildSupportMenu() {
  return Markup.keyboard([
    [NEW_TICKET_BUTTON, MY_TICKETS_BUTTON],
    [REPLY_TICKET_BUTTON],
    ["🔙 بازگشت"],
  ]).resize().persistent();
}

function buildCancelMenu() {
  return Markup.keyboard([
    [CANCEL_BUTTON],
  ]).resize().oneTime(true);
}

function getTelegramId(ctx) {
  return ctx.from?.id ? String(ctx.from.id) : null;
}

async function getCurrentUser(ctx) {
  if (!ctx.from?.id) {
    throw new Error("Telegram user is required");
  }

  return userService.getOrCreateUser(ctx.from);
}

async function showSupportMenu(ctx) {
  await ctx.reply(
    "🆘 پشتیبانی زکا\n\n" +
      "از این بخش می‌توانی تیکت ثبت کنی، وضعیت درخواست‌های قبلی را ببینی یا پیام جدید ارسال کنی.",
    buildSupportMenu()
  );
}

async function startNewTicket(ctx) {
  const user = await getCurrentUser(ctx);

  const existingTicket =
    await supportRepository.findOpenTicketByUserId(user.id);

  if (existingTicket) {
    await ctx.reply(
      "⚠️ یک تیکت فعال داری.\n\n" +
        `شماره تیکت: ${existingTicket.ticket_id}\n\n` +
        "برای ادامه مکالمه از گزینه «✉️ پیام به تیکت فعال» استفاده کن.",
      buildSupportMenu()
    );
    return;
  }

  pendingActions.set(getTelegramId(ctx), {
    type: "NEW_TICKET",
    userId: user.id,
  });

  await ctx.reply(
    "📝 لطفاً موضوع و توضیحات مشکل یا درخواستت را در یک پیام بنویس.\n\n" +
      "پس از ارسال، تیکت پشتیبانی ساخته می‌شود.",
    buildCancelMenu()
  );
}

async function showMyTickets(ctx) {
  const user = await getCurrentUser(ctx);

  const tickets = await supportRepository.getUserTickets(
    user.id,
    {
      limit: 10,
      offset: 0,
    }
  );

  if (!tickets.length) {
    await ctx.reply(
      "📭 هنوز تیکتی ثبت نکرده‌ای.",
      buildSupportMenu()
    );
    return;
  }

  const statusLabels = {
    OPEN: "🟢 باز",
    IN_PROGRESS: "🔵 در حال بررسی",
    WAITING_USER: "🟡 منتظر پاسخ شما",
    RESOLVED: "✅ حل‌شده",
    CLOSED: "🔒 بسته‌شده",
  };

  const lines = tickets.map((ticket, index) => {
    const status =
      statusLabels[ticket.status] || ticket.status;

    return (
      `${index + 1}. ${ticket.ticket_id}\n` +
      `وضعیت: ${status}\n` +
      `موضوع: ${ticket.subject || "بدون عنوان"}\n` +
      `پیام‌ها: ${ticket.message_count || 0}`
    );
  });

  await ctx.reply(
    "📨 تیکت‌های اخیر تو:\n\n" +
      lines.join("\n\n"),
    buildSupportMenu()
  );
}

async function startTicketReply(ctx) {
  const user = await getCurrentUser(ctx);

  const ticket =
    await supportRepository.findOpenTicketByUserId(user.id);

  if (!ticket) {
    await ctx.reply(
      "📭 تیکت فعالی برای پاسخ دادن وجود ندارد.\n\n" +
        "برای شروع، یک تیکت جدید ثبت کن.",
      buildSupportMenu()
    );
    return;
  }

  pendingActions.set(getTelegramId(ctx), {
    type: "TICKET_REPLY",
    userId: user.id,
    ticketId: ticket.id,
    ticketCode: ticket.ticket_id,
  });

  await ctx.reply(
    `✉️ ارسال پیام برای تیکت ${ticket.ticket_id}\n\n` +
      "پیامت را ارسال کن.",
    buildCancelMenu()
  );
}

async function handlePendingMessage(ctx, next) {
  const telegramId = getTelegramId(ctx);
  const pending = pendingActions.get(telegramId);

  if (!pending) {
    return next();
  }

  const message = ctx.message?.text;

  if (!message) {
    await ctx.reply("لطفاً پیام متنی ارسال کن.");
    return;
  }

  const normalizedMessage = message.trim();

  if (normalizedMessage === CANCEL_BUTTON) {
    pendingActions.delete(telegramId);

    await ctx.reply(
      "عملیات لغو شد.",
      buildSupportMenu()
    );
    return;
  }

  if (message.startsWith("/")) {
    await ctx.reply(
      "برای ادامه، متن پیام را ارسال کن یا عملیات را لغو کن.",
      buildCancelMenu()
    );
    return;
  }

  if (normalizedMessage.length < 3) {
    await ctx.reply(
      "پیام خیلی کوتاه است. لطفاً توضیحات بیشتری بنویس.",
      buildCancelMenu()
    );
    return;
  }

  if (message.length > 4000) {
    await ctx.reply(
      "حداکثر طول پیام ۴۰۰۰ کاراکتر است.",
      buildCancelMenu()
    );
    return;
  }

  try {
    if (pending.type === "NEW_TICKET") {
      const ticket = await supportRepository.createTicket({
        userId: pending.userId,
        category: "OTHER",
        priority: "NORMAL",
        subject: normalizedMessage.slice(0, 200),
        message: normalizedMessage,
        metadata: {
          source: "telegram",
          telegram_user_id: telegramId,
        },
      });

      pendingActions.delete(telegramId);

      await ctx.reply(
        "✅ تیکت پشتیبانی با موفقیت ثبت شد.\n\n" +
          `شماره پیگیری: ${ticket.ticket_id}\n` +
          "وضعیت: 🟢 باز\n\n" +
          "پاسخ پشتیبانی از طریق همین ربات برایت ارسال می‌شود.",
        buildSupportMenu()
      );

      return;
    }

    if (pending.type === "TICKET_REPLY") {
      const ticket =
        await supportRepository.findTicketById(
          pending.ticketId
        );

      if (
        !ticket ||
        String(ticket.user_id) !== String(pending.userId)
      ) {
        pendingActions.delete(telegramId);

        await ctx.reply(
          "❌ تیکت پیدا نشد یا به حساب تو تعلق ندارد.",
          buildSupportMenu()
        );
        return;
      }

      if (
        !["OPEN", "IN_PROGRESS", "WAITING_USER"].includes(
          ticket.status
        )
      ) {
        pendingActions.delete(telegramId);

        await ctx.reply(
          "این تیکت دیگر فعال نیست. برای ادامه، تیکت جدید ثبت کن.",
          buildSupportMenu()
        );
        return;
      }

      await supportRepository.addMessage({
        ticketId: ticket.id,
        senderUserId: pending.userId,
        senderType: "USER",
        message: normalizedMessage,
        ticketStatus: "OPEN",
      });

      pendingActions.delete(telegramId);

      await ctx.reply(
        "✅ پیام تو به تیکت ارسال شد.\n\n" +
          `شماره تیکت: ${pending.ticketCode}`,
        buildSupportMenu()
      );

      return;
    }

    pendingActions.delete(telegramId);

    await ctx.reply(
      "❌ عملیات نامعتبر است.",
      buildSupportMenu()
    );
  } catch (error) {
    console.error("Support message failed:", {
      telegramId,
      error: error.message,
    });

    await ctx.reply(
      "❌ ثبت پیام انجام نشد. لطفاً دوباره تلاش کن.",
      buildCancelMenu()
    );
  }
}

function createSupportHandler({ bot }) {
  if (!bot) {
    throw new Error("Bot instance is required");
  }

  bot.hears(SUPPORT_BUTTON, async (ctx) => {
    try {
      await showSupportMenu(ctx);
    } catch (error) {
      console.error("Show support menu failed:", error);
      await ctx.reply("❌ دریافت منوی پشتیبانی ناموفق بود.");
    }
  });

  bot.hears(NEW_TICKET_BUTTON, async (ctx) => {
    try {
      await startNewTicket(ctx);
    } catch (error) {
      console.error("Start support ticket failed:", error);
      await ctx.reply("❌ شروع ثبت تیکت ناموفق بود.");
    }
  });

  bot.hears(MY_TICKETS_BUTTON, async (ctx) => {
    try {
      await showMyTickets(ctx);
    } catch (error) {
      console.error("Show user tickets failed:", error);
      await ctx.reply("❌ دریافت تیکت‌ها ناموفق بود.");
    }
  });

  bot.hears(REPLY_TICKET_BUTTON, async (ctx) => {
    try {
      await startTicketReply(ctx);
    } catch (error) {
      console.error("Start ticket reply failed:", error);
      await ctx.reply("❌ امکان ارسال پیام وجود ندارد.");
    }
  });

  bot.on("text", handlePendingMessage);
}

module.exports = {
  createSupportHandler,
  showSupportMenu,
};
