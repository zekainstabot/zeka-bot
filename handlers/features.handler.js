
function createFeaturesHandler({ bot, mainMenu }) {
  const { getOrCreateUser } = require("../services/user.service");
  const { parseUrl } = require("../services/url.service");

  const {
    createScheduledPost,
    listScheduledPosts,
    getScheduledPostById,
    cancelScheduledPost,
    reschedulePost,
  } = require("../features/scheduled-publishing/publishing.repository");

  const {
    addUserChannel,
    listUserChannels,
    removeUserChannel,
  } = require("../features/scheduled-publishing/channels.repository");

  const states = new Map();
  const SESSION_TIMEOUT = 10 * 60 * 1000;

  const featuresMenu = {
    reply_markup: {
      keyboard: [
        ["📢 مدیریت انتشار محتوا"],
        ["🎡 گردونه شانس", "🧠 مسابقه"],
        ["📜 فال حافظ"],
        ["🔙 بازگشت"],
      ],
      resize_keyboard: true,
      persistent: true,
    },
  };

  const publishingMenu = {
    reply_markup: {
      keyboard: [
        ["📢 اتصال کانال من", "➕ ثبت کانال"],
        ["📋 کانال‌های من", "🗑 حذف کانال"],
        ["📅 انتشار زمان‌بندی‌شده"],
        ["📊 پیگیری انتشارها"],
        ["🔙 بازگشت"],
      ],
      resize_keyboard: true,
      persistent: true,
    },
  };

  const scheduleMenu = {
    reply_markup: {
      keyboard: [
        ["⚡ به‌محض آماده‌شدن"],
        ["⏱ 1 ساعت", "⏱ 3 ساعت"],
        ["⏱ 7 ساعت", "⏱ 12 ساعت"],
        ["📅 فردا", "📅 پس‌فردا"],
        ["📅 یک هفته بعد"],
        ["🔙 بازگشت"],
      ],
      resize_keyboard: true,
      persistent: true,
    },
  };

  function getState(ctx) {
    return states.get(String(ctx.from.id));
  }

  function setState(ctx, state) {
    states.set(String(ctx.from.id), {
      ...state,
      createdAt: Date.now(),
    });
  }

  function clearState(ctx) {
    states.delete(String(ctx.from.id));
  }

  async function getDatabaseUser(ctx) {
    const user = await getOrCreateUser(ctx.from);

    if (!user || !user.id) {
      throw new Error("User database record not found");
    }

    return user;
  }

  function isSupportedMediaUrl(value) {
    const parsed = parseUrl(value);

    return Boolean(parsed.valid && parsed.url && parsed.platform);
  }

  async function verifyChannel(ctx, text) {
    const input = text.trim();
    let chatId = input;

    if (!input) {
      throw new Error("آیدی یا لینک کانال را وارد کن.");
    }

    if (
      /^https?:\/\//i.test(input) ||
      /^(t\.me|telegram\.me)\//i.test(input)
    ) {
      let url;

      try {
        url = new URL(
          /^https?:\/\//i.test(input) ? input : `https://${input}`
        );
      } catch {
        throw new Error("لینک واردشده معتبر نیست.");
      }

      const hostname = url.hostname.toLowerCase();

      if (
        ![
          "t.me",
          "www.t.me",
          "telegram.me",
          "www.telegram.me",
        ].includes(hostname)
      ) {
        throw new Error("لطفاً لینک کانال تلگرام را وارد کن.");
      }

      const parts = url.pathname.split("/").filter(Boolean);

      if (
        parts.length >= 2 &&
        parts[0] === "c" &&
        /^\d+$/.test(parts[1])
      ) {
        chatId = `-100${parts[1]}`;
      } else if (
        parts.length >= 1 &&
        /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(parts[0]) &&
        ![
          "joinchat",
          "addstickers",
          "share",
          "proxy",
          "socks",
          "login",
          "confirmphone",
        ].includes(parts[0].toLowerCase())
      ) {
        chatId = `@${parts[0]}`;
      } else {
        throw new Error(
          "این لینک قابل شناسایی نیست. لینک عمومی یا آیدی عددی کانال را بفرست."
        );
      }
    } else if (/^@[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(input)) {
      chatId = input;
    } else if (/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(input)) {
      chatId = `@${input}`;
    } else if (/^-100\d+$/.test(input)) {
      chatId = input;
    } else if (/^100\d+$/.test(input)) {
      chatId = `-${input}`;
    } else {
      throw new Error(
        "فرمت آیدی کانال معتبر نیست.\n\n" +
          "آیدی با @، نام کاربری بدون @، لینک کانال یا آیدی عددی با -100 را بفرست."
      );
    }

    let channel;

    try {
      channel = await ctx.telegram.getChat(chatId);
    } catch {
      throw new Error(
        "کانال پیدا نشد. آیدی را بررسی کن و مطمئن شو ربات به کانال دسترسی دارد."
      );
    }

    if (channel.type !== "channel") {
      throw new Error("مقصد واردشده کانال تلگرام نیست.");
    }

    const botInfo = await ctx.telegram.getMe();
    let member;

    try {
      member = await ctx.telegram.getChatMember(channel.id, botInfo.id);
    } catch {
      throw new Error(
        "دریافت دسترسی ربات ممکن نشد. ربات را به کانال اضافه کن و دوباره امتحان کن."
      );
    }

    if (
      !["administrator", "creator"].includes(member.status) ||
      member.can_post_messages === false
    ) {
      throw new Error(
        "ربات باید ادمین کانال باشد و اجازه انتشار پیام داشته باشد."
      );
    }

    return channel;
  }

  function getScheduledAt(choice) {
    const now = new Date();

    if (choice === "⚡ به‌محض آماده‌شدن") {
      return now;
    }

    const scheduledAt = new Date(now);

    const hours = {
      "⏱ 1 ساعت": 1,
      "⏱ 3 ساعت": 3,
      "⏱ 7 ساعت": 7,
      "⏱ 12 ساعت": 12,
    };

    if (hours[choice]) {
      scheduledAt.setTime(
        now.getTime() + hours[choice] * 60 * 60 * 1000
      );

      return scheduledAt;
    }

    const days = {
      "📅 فردا": 1,
      "📅 پس‌فردا": 2,
      "📅 یک هفته بعد": 7,
    };

    if (days[choice]) {
      scheduledAt.setDate(scheduledAt.getDate() + days[choice]);
      return scheduledAt;
    }

    return null;
  }

  function getChannelTitle(channel) {
    return (
      channel.channel_title ||
      channel.channel_username ||
      String(channel.telegram_chat_id)
    );
  }

  function getChannelLabel(channel) {
    return `📢 ${getChannelTitle(channel)} [${channel.id}]`;
  }

  function getRemoveLabel(channel) {
    return `🗑 ${getChannelTitle(channel)} [${channel.id}]`;
  }

  function getChannelKeyboard(channels, labelFunction) {
    const keyboard = channels.map((channel) => [
      labelFunction(channel),
    ]);

    keyboard.push(["🔙 بازگشت"]);

    return {
      reply_markup: {
        keyboard,
        resize_keyboard: true,
        persistent: true,
      },
    };
  }

  function getPostStatusLabel(post) {
    const stage = post.progress_stage;

    if (post.status === "published" || stage === "sent") {
      return "✅ منتشر شده";
    }

    if (post.status === "cancelled" || stage === "cancelled") {
      return "🚫 لغو شده";
    }

    if (stage === "download_failed") {
      return "❌ خطا در دانلود";
    }

    if (stage === "send_failed") {
      return "❌ خطا در ارسال تلگرام";
    }

    if (post.status === "failed") {
      return "❌ ناموفق";
    }

    if (stage === "sending") {
      return "📤 در حال ارسال به تلگرام";
    }

    if (stage === "downloaded") {
      return "📦 دانلود انجام شده";
    }

    if (stage === "downloading" || post.status === "processing") {
      return "⏳ در حال دانلود";
    }

    return "🕒 در انتظار انتشار";
  }

  function getPostLabel(post) {
    return `📄 انتشار #${post.id} — ${getPostStatusLabel(post)}`;
  }

  function getPostsKeyboard(posts) {
    const keyboard = posts.map((post) => [getPostLabel(post)]);

    keyboard.push(["🔄 تازه‌سازی فهرست"]);
    keyboard.push(["🔙 بازگشت"]);

    return {
      reply_markup: {
        keyboard,
        resize_keyboard: true,
        persistent: true,
      },
    };
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
    });
  }

  function getPostDetailText(post) {
    const lines = [
      `📄 جزئیات انتشار #${post.id}`,
      "",
      `📢 کانال: ${post.channel_title || post.telegram_chat_id}`,
      `🆔 شناسه کانال: ${post.telegram_chat_id}`,
      `📌 وضعیت: ${getPostStatusLabel(post)}`,
      `🕒 زمان برنامه‌ریزی‌شده: ${formatDate(post.scheduled_at)}`,
      `📅 زمان ایجاد: ${formatDate(post.created_at)}`,
      `📤 زمان انتشار: ${formatDate(post.published_at)}`,
      `🔁 تعداد تلاش‌ها: ${post.attempts ?? 0}`,
      "",
      `🔗 لینک منبع: ${post.source_url}`,
    ];

    if (post.download_completed_at) {
      lines.push(
        `📥 پایان دانلود: ${formatDate(post.download_completed_at)}`
      );
    }

    if (post.send_started_at) {
      lines.push(
        `📤 شروع ارسال: ${formatDate(post.send_started_at)}`
      );
    }

    if (post.error_message) {
      lines.push(
        "",
        "⚠️ شرح خطا:",
        String(post.error_message).slice(0, 1200)
      );
    }

    return lines.join("\n");
  }

  function getPostActionsKeyboard(post) {
    const keyboard = [];

    if (post.status === "pending") {
      keyboard.push([`🚫 لغو انتشار #${post.id}`]);
    }

    if (post.status === "failed") {
      keyboard.push([`🔄 تلاش مجدد #${post.id}`]);
    }

    keyboard.push(["📊 پیگیری انتشارها"]);
    keyboard.push(["🔙 بازگشت"]);

    return {
      reply_markup: {
        keyboard,
        resize_keyboard: true,
        persistent: true,
      },
    };
  }

  async function showScheduledPosts(ctx) {
    clearState(ctx);

    try {
      const user = await getDatabaseUser(ctx);
      const posts = await listScheduledPosts(
  user.id,
  ["pending", "processing", "failed"]
);

      if (!posts.length) {
        await ctx.reply(
          "📊 هنوز برنامه انتشاری ثبت نکرده‌ای.\n\n" +
            "برای شروع، گزینه «📅 انتشار زمان‌بندی‌شده» را انتخاب کن.",
          publishingMenu
        );

        return;
      }

      const visiblePosts = posts.slice(-30).reverse();

      setState(ctx, {
        step: "scheduled_posts_list",
        posts: visiblePosts,
      });

      await ctx.reply(
        `📊 برنامه‌های انتشار حساب تو\n\nتعداد نمایش‌داده‌شده: ${visiblePosts.length}\n\n` +
          "برای دیدن جزئیات، یکی از انتشارها را انتخاب کن.",
        getPostsKeyboard(visiblePosts)
      );
    } catch (error) {
      console.error(
        "List scheduled posts failed:",
        error?.message || error
      );

      await ctx.reply(
        "❌ دریافت فهرست انتشارها انجام نشد. دوباره تلاش کن.",
        publishingMenu
      );
    }
  }

  bot.hears("🛠 امکانات ویژه", async (ctx) => {
    clearState(ctx);

    await ctx.reply(
      "🛠 امکانات ویژه\n\nیکی از امکانات را انتخاب کن.",
      featuresMenu
    );
  });

  bot.hears("📢 مدیریت انتشار محتوا", async (ctx) => {
    clearState(ctx);

    await ctx.reply(
      "📢 مدیریت انتشار محتوا\n\n" +
        "ثبت کانال، زمان‌بندی، پیگیری و مدیریت انتشارها از این بخش انجام می‌شود.",
      publishingMenu
    );
  });

  bot.hears("📢 اتصال کانال من", async (ctx) => {
    clearState(ctx);

    await ctx.reply(
      "📢 راهنمای اتصال کانال به زکا\n\n" +
        "برای افزودن مستقیم ربات به کانالت، دکمه زیر را بزن و کانال را انتخاب کن.\n" +
        "سپس دسترسی ارسال پیام را تأیید کن.\n\n" +
        "بعد از ادمین‌کردن ربات، گزینه «➕ ثبت کانال» را بزن.\n\n" +
        "برای کانال عمومی، آیدی آن مثل @mychannel را بفرست. " +
        "برای کانال خصوصی، آیدی عددی کانال یا لینک پست آن را بفرست.",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "➕ افزودن زکا به کانال",
                url: "https://t.me/zekagpt_bot?startchannel&admin=post_messages",
              },
            ],
          ],
        },
      }
    );
  });

  bot.hears("➕ ثبت کانال", async (ctx) => {
    clearState(ctx);

    setState(ctx, {
      step: "register_channel",
    });

    await ctx.reply(
      "➕ ثبت کانال\n\n" +
        "یکی از این موارد را بفرست:\n\n" +
        "• آیدی با @ مثل @mychannel\n" +
        "• نام کاربری بدون @ مثل mychannel\n" +
        "• لینک کانال مثل https://t.me/mychannel\n" +
        "• آیدی عددی مثل -1001234567890\n" +
        "• لینک پست کانال خصوصی مثل https://t.me/c/123456789/10\n\n" +
        "ربات باید در کانال ادمین باشد و اجازه انتشار پیام داشته باشد.\n\n" +
        "لینک دعوت خصوصی به‌تنهایی برای ثبت کانال کافی نیست.\n" +
        "برای لغو، «🔙 بازگشت» را بزن.",
      publishingMenu
    );
  });

  bot.hears("📋 کانال‌های من", async (ctx) => {
    clearState(ctx);

    try {
      const user = await getDatabaseUser(ctx);
      const channels = await listUserChannels(user.id);

      if (!channels.length) {
        await ctx.reply(
          "📋 هنوز کانالی ثبت نکرده‌ای.\n\n" +
            "ابتدا گزینه «➕ ثبت کانال» را انتخاب کن.",
          publishingMenu
        );

        return;
      }

      const lines = channels.map((channel, index) => {
        const username = channel.channel_username
          ? `\n   آیدی: @${channel.channel_username}`
          : "";

        return (
          `${index + 1}. ${getChannelTitle(channel)}\n` +
          `   شناسه ثبت: ${channel.id}\n` +
          `   آیدی تلگرام: ${channel.telegram_chat_id}` +
          username
        );
      });

      await ctx.reply(
        "📋 کانال‌های ثبت‌شده حساب تو:\n\n" + lines.join("\n\n"),
        publishingMenu
      );
    } catch (error) {
      console.error(
        "List user channels failed:",
        error?.message || error
      );

      await ctx.reply(
        "❌ دریافت فهرست کانال‌ها انجام نشد. دوباره تلاش کن.",
        publishingMenu
      );
    }
  });

  bot.hears("🗑 حذف کانال", async (ctx) => {
    clearState(ctx);

    try {
      const user = await getDatabaseUser(ctx);
      const channels = await listUserChannels(user.id);

      if (!channels.length) {
        await ctx.reply("کانالی برای حذف وجود ندارد.", publishingMenu);
        return;
      }

      setState(ctx, {
        step: "remove_channel",
        channels,
      });

      await ctx.reply(
        "🗑 کانالی را که می‌خواهی از حساب خودت حذف کنی انتخاب کن.",
        getChannelKeyboard(channels, getRemoveLabel)
      );
    } catch (error) {
      console.error(
        "Prepare channel removal failed:",
        error?.message || error
      );

      await ctx.reply(
        "❌ دریافت کانال‌ها انجام نشد. دوباره تلاش کن.",
        publishingMenu
      );
    }
  });

  bot.hears("📅 انتشار زمان‌بندی‌شده", async (ctx) => {
    clearState(ctx);

    setState(ctx, {
      step: "source_url",
    });

    await ctx.reply(
      "📅 انتشار زمان‌بندی‌شده\n\n" +
        "لینک عمومی محتوایی را که می‌خواهی منتشر شود بفرست.\n\n" +
        "لینک باید متعلق به یکی از پلتفرم‌های شناسایی‌شده توسط زکا باشد.",
      publishingMenu
    );
  });

  bot.hears("📊 پیگیری انتشارها", showScheduledPosts);
  bot.hears("🔄 تازه‌سازی فهرست", showScheduledPosts);

  bot.on("text", async (ctx, next) => {
    const state = getState(ctx);

    if (!state) {
      return next();
    }

    const text = ctx.message.text.trim();

    if (Date.now() - state.createdAt > SESSION_TIMEOUT) {
      clearState(ctx);

      await ctx.reply(
        "⏱ زمان این فرایند تمام شد. دوباره از امکانات ویژه شروع کن.",
        mainMenu
      );

      return;
    }

    if (text === "🔙 بازگشت") {
      clearState(ctx);

      await ctx.reply("📢 مدیریت انتشار محتوا", publishingMenu);
      return;
    }

    if (
      [
        "📥 دانلود",
        "👤 حساب من",
        "🎁 هدایا",
        "⭐ زکا پرو",
        "🎮 مینی‌گیم‌ها",
        "🛠 امکانات ویژه",
        "🔮 فال",
        "📜 فال حافظ",
        "🎡 گردونه شانس",
        "🧩 آزمون و مسابقه",
        "📢 مدیریت انتشار محتوا",
        "📢 اتصال کانال من",
        "➕ ثبت کانال",
        "📋 کانال‌های من",
        "🗑 حذف کانال",
        "📅 انتشار زمان‌بندی‌شده",
        "📊 پیگیری انتشارها",
        "🔄 تازه‌سازی فهرست",
      ].includes(text)
    ) {
      clearState(ctx);
      return next();
    }

    if (state.step === "register_channel") {
      let channel;

      try {
        channel = await verifyChannel(ctx, text);
      } catch (error) {
        await ctx.reply(
          "❌ ثبت کانال انجام نشد.\n\n" +
            (error.message ||
              "کانال پیدا نشد یا دسترسی ربات کافی نیست.") +
            "\n\n" +
            "آیدی کانال را بررسی کن و مطمئن شو ربات ادمین است و اجازه انتشار پیام دارد.\n\n" +
            "مثال کانال عمومی: @mychannel"
        );

        return;
      }

      try {
        const user = await getDatabaseUser(ctx);

        const savedChannel = await addUserChannel({
          userId: user.id,
          telegramChatId: String(channel.id),
          channelTitle: channel.title || channel.username || null,
          channelUsername: channel.username || null,
        });

        clearState(ctx);

        await ctx.reply(
          "✅ کانال با موفقیت ثبت شد.\n\n" +
            `📢 نام کانال: ${getChannelTitle(savedChannel)}\n` +
            `🆔 آیدی کانال: ${savedChannel.telegram_chat_id}\n\n` +
            "این کانال به حساب خودت متصل شد.",
          publishingMenu
        );
      } catch (error) {
        console.error(
          "Register user channel failed:",
          error?.message || error
        );

        await ctx.reply(
          "❌ ذخیره کانال در پایگاه داده انجام نشد. دوباره تلاش کن.",
          publishingMenu
        );
      }

      return;
    }

    if (state.step === "remove_channel") {
      const selectedChannel = state.channels.find(
        (channel) => getRemoveLabel(channel) === text
      );

      if (!selectedChannel) {
        await ctx.reply(
          "از دکمه‌های فهرست، کانال موردنظر را انتخاب کن.",
          getChannelKeyboard(state.channels, getRemoveLabel)
        );

        return;
      }

      try {
        const user = await getDatabaseUser(ctx);

        const removedChannel = await removeUserChannel(
          selectedChannel.id,
          user.id
        );

        clearState(ctx);

        if (!removedChannel) {
          await ctx.reply(
            "این کانال در حساب تو ثبت نشده یا قبلاً حذف شده است.",
            publishingMenu
          );

          return;
        }

        await ctx.reply(
          "✅ کانال از فهرست حساب تو حذف شد.\n\n" +
            "برنامه‌های انتشار قبلی به‌صورت خودکار حذف نمی‌شوند.",
          publishingMenu
        );
      } catch (error) {
        console.error(
          "Remove user channel failed:",
          error?.message || error
        );

        await ctx.reply(
          "❌ حذف کانال انجام نشد. دوباره تلاش کن.",
          publishingMenu
        );
      }

      return;
    }

    if (state.step === "source_url") {
      const parsedUrl = parseUrl(text);

      if (!isSupportedMediaUrl(text)) {
        await ctx.reply(
          "❌ لینک معتبر نیست یا پلتفرم آن شناسایی نمی‌شود.\n" +
            "لطفاً لینک محتوای موردنظر را دوباره بفرست."
        );

        return;
      }

      try {
        const user = await getDatabaseUser(ctx);
        const channels = await listUserChannels(user.id);

        if (!channels.length) {
          clearState(ctx);

          await ctx.reply(
            "❌ هنوز کانالی ثبت نکرده‌ای.\n\n" +
              "۱. از مدیریت انتشار محتوا، «📢 اتصال کانال من» را باز کن.\n" +
              "۲. ربات را در کانالت ادمین کن.\n" +
              "۳. گزینه «➕ ثبت کانال» را بزن.\n" +
              "۴. دوباره انتشار زمان‌بندی‌شده را شروع کن.",
            publishingMenu
          );

          return;
        }

        setState(ctx, {
          step: "select_schedule_channel",
          sourceUrl: parsedUrl.url,
          channels,
        });

        await ctx.reply(
          "✅ لینک دریافت شد.\n\n" +
            "📢 کانالی را برای انتشار انتخاب کن:",
          getChannelKeyboard(channels, getChannelLabel)
        );
      } catch (error) {
        console.error(
          "Load channels for scheduling failed:",
          error?.message || error
        );

        await ctx.reply(
          "❌ دریافت کانال‌ها انجام نشد. دوباره تلاش کن.",
          publishingMenu
        );
      }

      return;
    }

    if (state.step === "select_schedule_channel") {
      const selectedChannel = state.channels.find(
        (channel) => getChannelLabel(channel) === text
      );

      if (!selectedChannel) {
        await ctx.reply(
          "از دکمه‌های فهرست، کانال مقصد را انتخاب کن.",
          getChannelKeyboard(state.channels, getChannelLabel)
        );

        return;
      }

      setState(ctx, {
        step: "schedule",
        sourceUrl: state.sourceUrl,
        telegramChatId: String(selectedChannel.telegram_chat_id),
        channelTitle: getChannelTitle(selectedChannel),
      });

      await ctx.reply(
        "✅ کانال انتخاب شد.\n" +
          `📢 مقصد: ${getChannelTitle(selectedChannel)}\n\n` +
          "زمان انتشار را انتخاب کن:",
        scheduleMenu
      );

      return;
    }

    if (state.step === "schedule") {
      const scheduledAt = getScheduledAt(text);

      if (!scheduledAt) {
        await ctx.reply(
          "یکی از زمان‌های موجود در منو را انتخاب کن.",
          scheduleMenu
        );

        return;
      }

      try {
        const user = await getDatabaseUser(ctx);

        const post = await createScheduledPost({
          userId: user.id,
          telegramChatId: state.telegramChatId,
          channelTitle: state.channelTitle,
          sourceUrl: state.sourceUrl,
          scheduledAt: scheduledAt.toISOString(),
          captionMode: "original",
          captionOrder: "original_first",
        });

        clearState(ctx);

        const isImmediate = text === "⚡ به‌محض آماده‌شدن";

        await ctx.reply(
          "✅ انتشار " +
            (isImmediate
              ? "در صف آماده‌سازی قرار گرفت."
              : "زمان‌بندی شد.") +
            "\n\n" +
            `🆔 شماره برنامه: ${post.id}\n` +
            `📢 کانال: ${state.channelTitle || state.telegramChatId}\n` +
            `🕒 زمان انتشار: ${
              isImmediate
                ? "به‌محض رسیدن نوبت پردازش"
                : scheduledAt.toLocaleString("fa-IR", {
                    timeZone: "Asia/Tehran",
                  })
            }\n\n` +
            "برنامه انتشار به حساب خودت متصل است.",
          publishingMenu
        );
      } catch (error) {
        console.error(
          "Create scheduled post failed:",
          error?.message || error
        );

        await ctx.reply(
          "❌ ثبت برنامه انتشار انجام نشد.\n" +
            "اطلاعات این مرحله پاک نشده است؛ دوباره زمان را انتخاب کن.",
          scheduleMenu
        );
      }

      return;
    }

    if (state.step === "scheduled_posts_list") {
      const selectedPost = state.posts.find(
        (post) => getPostLabel(post) === text
      );

      if (!selectedPost) {
        await ctx.reply(
          "از دکمه‌های فهرست، یکی از انتشارها را انتخاب کن.",
          getPostsKeyboard(state.posts)
        );

        return;
      }

      try {
        const user = await getDatabaseUser(ctx);
        const post = await getScheduledPostById(selectedPost.id, user.id);

        if (!post) {
          await showScheduledPosts(ctx);
          return;
        }

        setState(ctx, {
          step: "scheduled_post_detail",
          postId: post.id,
        });

        await ctx.reply(
          getPostDetailText(post),
          getPostActionsKeyboard(post)
        );
      } catch (error) {
        console.error(
          "Get scheduled post details failed:",
          error?.message || error
        );

        await ctx.reply(
          "❌ دریافت جزئیات انتشار انجام نشد.",
          publishingMenu
        );
      }

      return;
    }

    if (state.step === "scheduled_post_detail") {
      const postId = state.postId;
      const retryRequested = text === `🔄 تلاش مجدد #${postId}`;
      const cancelRequested = text === `🚫 لغو انتشار #${postId}`;

      if (!retryRequested && !cancelRequested) {
        await ctx.reply(
          "از گزینه‌های نمایش‌داده‌شده برای این انتشار استفاده کن."
        );

        return;
      }

      try {
        const user = await getDatabaseUser(ctx);
        const post = await getScheduledPostById(postId, user.id);

        if (!post) {
          clearState(ctx);

          await ctx.reply(
            "این برنامه انتشار پیدا نشد.",
            publishingMenu
          );

          return;
        }

        if (cancelRequested) {
          const cancelled = await cancelScheduledPost(postId, user.id);

          if (!cancelled) {
            await ctx.reply(
              "این انتشار دیگر در وضعیت قابل لغو نیست. فهرست را تازه کن."
            );

            return;
          }

          clearState(ctx);

          await ctx.reply(
            `✅ برنامه انتشار #${postId} لغو شد.`,
            publishingMenu
          );

          return;
        }

        if (retryRequested) {
          if (post.status !== "failed") {
            await ctx.reply(
              "فقط انتشارهای ناموفق را می‌توان دوباره به صف فرستاد."
            );

            return;
          }

          const retried = await reschedulePost(
            postId,
            user.id,
            new Date(Date.now() + 5000).toISOString()
          );

          if (!retried) {
            await ctx.reply(
              "❌ ثبت تلاش مجدد انجام نشد. وضعیت انتشار را تازه کن."
            );

            return;
          }

          clearState(ctx);

          await ctx.reply(
            `🔄 انتشار #${postId} دوباره به صف ارسال شد.\n\n` +
              "وضعیت آن را می‌توانی از بخش «📊 پیگیری انتشارها» بررسی کنی.",
            publishingMenu
          );

          return;
        }
      } catch (error) {
        console.error(
          "Scheduled post action failed:",
          error?.message || error
        );

        await ctx.reply(
          "❌ انجام عملیات روی انتشار انجام نشد. دوباره تلاش کن."
        );
      }

      return;
    }

    return next();
  });
}

module.exports = {
  createFeaturesHandler,
};
