const { Markup } = require("telegraf");
const service = require("./friend-quiz.service");
const userRepository = require("../../repositories/user.repository");
const { getOrCreateUser } = require("../../services/user.service");

const roundTimers = new Map();
const advancingRooms = new Set();

function clearRoundTimer(roomId) {
  const timer = roundTimers.get(String(roomId));
  if (timer) clearTimeout(timer);
  roundTimers.delete(String(roomId));
}

function getAnswerKeyboard(roomId, round, options) {
  return Markup.inlineKeyboard(
    options.map((option, index) => [
      Markup.button.callback(
        `${String.fromCharCode(65 + index)}. ${option}`.slice(0, 60),
        `fq:a:${roomId}:${round}:${index}`
      ),
    ])
  );
}

async function getPlayerTelegramIds(room) {
  return room.players
    .map((player) => String(player.telegram_user_id || ""))
    .filter(Boolean);
}

async function sendRound(bot, roomId) {
  const room = await service.getRoom(roomId);
  if (!room || room.status !== "ACTIVE") return;
  const snapshot = room.question_snapshot || {};
  const text =
    `🤝 مسابقه دوستانه | سؤال ${room.current_round} از ${room.total_rounds}\n\n` +
    `${snapshot.questionText}\n\n⏱ مهلت پاسخ: ${service.ROUND_SECONDS} ثانیه`;
  const keyboard = getAnswerKeyboard(room.id, room.current_round, snapshot.options || []);

  if (room.mode === "GROUP") {
    await bot.telegram.sendMessage(room.group_chat_id, text, keyboard);
  } else {
    const ids = await getPlayerTelegramIds(room);
    for (const telegramId of ids) {
      await bot.telegram.sendMessage(telegramId, text, keyboard);
    }
  }

  clearRoundTimer(room.id);
  const timer = setTimeout(async () => {
    roundTimers.delete(String(room.id));
    try {
      const current = await service.getRoom(room.id);
      if (!current || current.status !== "ACTIVE" || Number(current.current_round) !== Number(room.current_round)) return;
      await service.closeRound(room.id, room.current_round);
      await advanceRoom(bot, room.id);
    } catch (error) {
      console.error("Friend quiz round timeout failed:", error);
    }
  }, service.ROUND_SECONDS * 1000);
  roundTimers.set(String(room.id), timer);
}

async function sendRoomResult(bot, room) {
  const result = room.result || {};
  let text;
  if (result.draw) {
    text = `🤝 مسابقه دوستانه مساوی شد!\n\n🏆 امتیاز هر دو نفر: ${result.score}\nهیچ اعتباری کم یا اضافه نشد.`;
  } else {
    const winner = room.players.find((player) => String(player.user_id) === String(result.winnerUserId));
    const loser = room.players.find((player) => String(player.user_id) === String(result.loserUserId));
    const winnerName = winner?.display_name || winner?.username || "برنده";
    const loserName = loser?.display_name || loser?.username || "بازیکن دوم";
    text =
      `🏁 مسابقه دوستانه تمام شد!\n\n🥇 برنده: ${winnerName} (${result.winnerScore} امتیاز)\n🥈 بازنده: ${loserName} (${result.loserScore} امتیاز)\n\n💳 جایزه برنده: +۵ اعتبار\n💳 جریمه بازنده: −۳ اعتبار` +
      (Number(result.debt || 0) > 0 ? `\n📕 بدهی ثبت‌شده بازنده: ${result.debt} اعتبار` : "");
  }
  if (room.mode === "GROUP") {
    await bot.telegram.sendMessage(room.group_chat_id, text);
  } else {
    for (const telegramId of await getPlayerTelegramIds(room)) {
      await bot.telegram.sendMessage(telegramId, text);
    }
  }
}

async function advanceRoom(bot, roomId) {
  const key = String(roomId);
  if (advancingRooms.has(key)) return;
  advancingRooms.add(key);
  clearRoundTimer(roomId);
  try {
    const room = await service.getRoom(roomId);
    if (!room || room.status !== "ACTIVE") return;
    if (Number(room.current_round) >= Number(room.total_rounds)) {
      const finished = await service.finishRoom(roomId);
      await sendRoomResult(bot, finished);
      return;
    }
    await service.startRound(roomId);
    await sendRound(bot, roomId);
  } catch (error) {
    console.error("Friend quiz advance failed:", error);
    const room = await service.getRoom(roomId).catch(() => null);
    if (room?.mode === "GROUP" && room.group_chat_id) {
      await bot.telegram.sendMessage(room.group_chat_id, "❌ ادامه مسابقه با خطا روبه‌رو شد.").catch(() => {});
    }
  } finally {
    advancingRooms.delete(key);
  }
}

async function beginRoom(bot, roomId) {
  await service.startRound(roomId);
  await sendRound(bot, roomId);
}

async function handleStartPayload(ctx, user, payload) {
  if (!String(payload || "").startsWith("fq_")) return false;
  const code = String(payload).slice(3);
  try {
    const room = await service.joinRoom({ code, userId: user.id });
    await ctx.reply("✅ به مسابقه دوستانه پیوستی! بازی همین الان شروع می‌شود.");
    const bot = { telegram: ctx.telegram };
    await beginRoom(bot, room.id);
  } catch (error) {
    const messages = {
      FRIEND_QUIZ_NOT_FOUND: "❌ لینک دعوت معتبر نیست یا مسابقه پیدا نشد.",
      FRIEND_QUIZ_NOT_WAITING: "⏳ این اتاق قبلاً شروع شده یا بسته شده است.",
      FRIEND_QUIZ_SELF_JOIN: "❌ نمی‌توانی با لینک خودت وارد مسابقه شوی.",
      FRIEND_QUIZ_ALREADY_ACTIVE: "⏳ در حال حاضر یک مسابقه دوستانه فعال داری.",
    };
    await ctx.reply(messages[error.message] || "❌ پیوستن به مسابقه انجام نشد.");
  }
  return true;
}

function createFriendQuizHandler({ bot, gamesMenu }) {
  bot.hears("👥 بازی با دوست", async (ctx) => {
    await ctx.reply(
      "🤝 بازی دوستانه\n\n" +
      "یک حالت را انتخاب کن:\n\n" +
      "👤 پی‌وی: لینک دعوت اختصاصی می‌گیری و دوستت با ورود به ربات به مسابقه ملحق می‌شود.\n" +
      "👥 گروه: ربات را به گروه اضافه کن و دستور /zekaquiz را در گروه بفرست.",
      Markup.inlineKeyboard([
        [Markup.button.callback("👤 ساخت لینک دعوت پی‌وی", "fq:create:dm")],
        [Markup.button.callback("👥 راهنمای بازی گروهی", "fq:group:help")],
      ])
    );
  });

  bot.action("fq:create:dm", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const user = await getOrCreateUser(ctx.from);
      const room = await service.createRoom({
        userId: user.id,
        mode: "DM",
        languageCode: ctx.state?.language || user.language || "fa",
      });
      const me = await bot.telegram.getMe();
      const inviteLink = `https://t.me/${me.username}?start=fq_${room.invite_code}`;
      await ctx.reply(
        "🎮 اتاق مسابقه ساخته شد!\n\n" +
        "این لینک را برای دوستت بفرست:\n" +
        inviteLink +
        "\n\nوقتی دوستت وارد ربات شود، مسابقه خودکار شروع می‌شود.\n" +
        "❓ تعداد سؤال‌ها: ۵\n⏱ زمان هر سؤال: ۲۰ ثانیه\n\n" +
        "🏆 برنده: +۵ اعتبار | بازنده: −۳ اعتبار",
        Markup.inlineKeyboard([
          [Markup.button.callback("❌ لغو دعوت", `fq:cancel:${room.id}`)],
        ])
      );
    } catch (error) {
      console.error("Friend quiz DM room creation failed:", error);
      const message = error.message === "FRIEND_QUIZ_ALREADY_ACTIVE"
        ? "⏳ یک مسابقه دوستانه فعال داری. اول آن را تمام کن."
        : "❌ ساخت اتاق دعوت انجام نشد. دوباره تلاش کن.";
      await ctx.reply(message, gamesMenu);
    }
  });

  bot.action("fq:group:help", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      "👥 برای بازی گروهی:\n\n" +
      "۱. ربات را به گروه اضافه کن.\n" +
      "۲. در گروه دستور /zekaquiz را بفرست.\n" +
      "۳. دوستت دکمه «پیوستن» را می‌زند.\n" +
      "۴. هر دو نفر در همان گروه به سؤال‌ها جواب می‌دهید.\n\n" +
      "فقط دو بازیکن در هر اتاق شرکت می‌کنند."
    );
  });

  bot.action(/^fq:cancel:(\\d+)$/, async (ctx) => {
    try {
      const user = await userRepository.findByTelegramId(String(ctx.from.id));
      if (!user) {
        await ctx.answerCbQuery("کاربر پیدا نشد.", { show_alert: true });
        return;
      }
      const cancelled = await service.cancelRoom(Number(ctx.match[1]), user.id);
      if (!cancelled) {
        await ctx.answerCbQuery("این دعوت قابل لغو نیست یا قبلاً شروع شده.", { show_alert: true });
        return;
      }
      await ctx.answerCbQuery("دعوت لغو شد.");
      await ctx.editMessageText("❌ دعوت مسابقه لغو شد.");
    } catch (error) {
      console.error("Friend quiz cancellation failed:", error);
      await ctx.answerCbQuery("لغو دعوت انجام نشد.", { show_alert: true }).catch(() => {});
    }
  });

  bot.command("zekaquiz", async (ctx) => {
    if (!ctx.chat || !["group", "supergroup"].includes(ctx.chat.type)) {
      await ctx.reply("این دستور را داخل گروه تلگرام اجرا کن.");
      return;
    }
    try {
      const user = await getOrCreateUser(ctx.from);
      const room = await service.createRoom({
        userId: user.id,
        mode: "GROUP",
        groupChatId: ctx.chat.id,
        languageCode: ctx.state?.language || user.language || "fa",
      });
      await ctx.reply(
        "🤝 اتاق مسابقه گروهی ساخته شد!\n\n" +
        "بازیکن اول: " + (ctx.from.first_name || "میزبان") + "\n" +
        "برای پیوستن بازیکن دوم، دکمه زیر را بزنید.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🎮 پیوستن به مسابقه", `fq:join:${room.invite_code}`)],
          [Markup.button.callback("❌ لغو دعوت", `fq:cancel:${room.id}`)],
        ])
      );
    } catch (error) {
      console.error("Friend quiz group room creation failed:", error);
      await ctx.reply(error.message === "FRIEND_QUIZ_ALREADY_ACTIVE"
        ? "⏳ یک مسابقه دوستانه فعال داری."
        : "❌ ساخت مسابقه گروهی انجام نشد.");
    }
  });

  bot.action(/^fq:join:([A-Z0-9_-]+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const user = await getOrCreateUser(ctx.from);
      const room = await service.joinRoom({ code: ctx.match[1], userId: user.id });
      await ctx.editMessageText("🤝 هر دو بازیکن حاضرند! مسابقه شروع شد.");
      await beginRoom(bot, room.id);
    } catch (error) {
      const messages = {
        FRIEND_QUIZ_SELF_JOIN: "سازنده اتاق نمی‌تواند دوباره وارد شود.",
        FRIEND_QUIZ_ALREADY_ACTIVE: "شما یک مسابقه فعال دیگر دارید.",
        FRIEND_QUIZ_NOT_WAITING: "این اتاق دیگر منتظر بازیکن نیست.",
        FRIEND_QUIZ_NOT_FOUND: "اتاق مسابقه پیدا نشد.",
      };
      await ctx.answerCbQuery(messages[error.message] || "پیوستن انجام نشد.", { show_alert: true }).catch(() => {});
    }
  });

  bot.action(/^fq:a:(\d+):(\d+):(\d+)$/, async (ctx) => {
    try {
      const [, roomId, round, optionIndex] = ctx.match;
      const user = await userRepository.findByTelegramId(String(ctx.from.id));
      if (!user) {
        await ctx.answerCbQuery("ابتدا /start را در پی‌وی ربات بزن.", { show_alert: true });
        return;
      }
      const result = await service.submitAnswer({
        roomId: Number(roomId),
        userId: user.id,
        round: Number(round),
        optionIndex: Number(optionIndex),
      });
      if (!result.accepted) {
        const message = result.reason === "ALREADY_ANSWERED" ? "پاسخت قبلاً ثبت شده." :
          result.reason === "NOT_PLAYER" ? "شما بازیکن این مسابقه نیستید." : "زمان این سؤال تمام شده.";
        await ctx.answerCbQuery(message, { show_alert: true });
        return;
      }
      await ctx.answerCbQuery(result.correct ? "✅ پاسخ درست ثبت شد." : "❌ پاسخ ثبت شد.");
      if (result.roundComplete) await advanceRoom(bot, Number(roomId));
    } catch (error) {
      console.error("Friend quiz answer failed:", error);
      await ctx.answerCbQuery("ثبت پاسخ با خطا روبه‌رو شد.", { show_alert: true }).catch(() => {});
    }
  });
}

function cleanupFriendQuizTimers() {
  for (const timer of roundTimers.values()) clearTimeout(timer);
  roundTimers.clear();
  advancingRooms.clear();
}

module.exports = {
  createFriendQuizHandler,
  handleStartPayload,
  cleanupFriendQuizTimers,
};
