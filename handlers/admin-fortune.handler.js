const {
  Markup,
} = require("telegraf");

const adminFortuneService =
  require(
    "../services/admin-fortune.service"
  );

const states = new Map();

const MENU_BUTTON =
  "🔮 مدیریت فال";

const ADD_BUTTON =
  "➕ افزودن فال دستی";

const IMPORT_BUTTON =
  "📥 ورود فال از سایت";

const BANK_BUTTON =
  "📚 بانک فال‌ها";

const STATS_BUTTON =
  "📊 آمار فال‌ها";

const CANCEL_TEXT =
  "❌ لغو";

function menu() {
  return Markup.keyboard([
    [ADD_BUTTON],
    [IMPORT_BUTTON],
    [
      BANK_BUTTON,
      STATS_BUTTON,
    ],
    [CANCEL_TEXT],
  ]).resize();
}

function categoryMenu(
  categories
) {
  return Markup.keyboard(
    categories
      .map((category) => [
        `${category.id}️⃣ ${category.name_fa}`,
      ])
      .concat([
        [CANCEL_TEXT],
      ])
  ).resize();
}

function getState(
  userId
) {
  return (
    states.get(
      String(userId)
    ) || null
  );
}

function setState(
  userId,
  state
) {
  states.set(
    String(userId),
    state
  );
}

function clearState(
  userId
) {
  states.delete(
    String(userId)
  );
}

async function handleMenu(
  ctx
) {
  try {
    await adminFortuneService.requireFortunePermission(
      ctx.from.id
    );

    await ctx.reply(
      "🔮 مدیریت فال\n\n" +
        "عملیات موردنظر را انتخاب کنید.",
      menu()
    );
  } catch (error) {
    console.error(
      "Fortune admin menu failed:",
      error
    );

    await ctx.reply(
      "⛔ شما دسترسی مدیریت فال را ندارید."
    );
  }
}

async function startManualAdd(
  ctx
) {
  try {
    await adminFortuneService.requireFortunePermission(
      ctx.from.id
    );

    const categories =
      await adminFortuneService.listCategories(
        ctx.from.id
      );

    if (!categories.length) {
      await ctx.reply(
        "❌ هیچ دسته فال فعالی وجود ندارد."
      );

      return;
    }

    setState(
      ctx.from.id,
      {
        step: "category",
        createdAt:
          Date.now(),
      }
    );

    await ctx.reply(
      "➕ افزودن فال دستی\n\n" +
        "دسته فال را انتخاب کن:",
      categoryMenu(
        categories
      )
    );
  } catch (error) {
    console.error(
      "Start manual fortune failed:",
      error
    );

    await ctx.reply(
      "❌ شروع افزودن فال انجام نشد."
    );
  }
}

async function handleText(
  ctx,
  next
) {
  const userId =
    ctx.from?.id;

  const state = userId
    ? getState(userId)
    : null;

  if (!state) {
    return next();
  }

  if (
    Date.now() -
      state.createdAt >
    10 * 60 * 1000
  ) {
    clearState(userId);

    await ctx.reply(
      "⏱️ زمان این عملیات تمام شده است.",
      menu()
    );

    return;
  }

  const text =
    String(
      ctx.message?.text ||
        ""
    ).trim();

  if (
    text === CANCEL_TEXT
  ) {
    clearState(userId);

    await ctx.reply(
      "❌ عملیات لغو شد.",
      menu()
    );

    return;
  }

  try {
    await adminFortuneService.requireFortunePermission(
      userId
    );

    if (
      state.step ===
      "category"
    ) {
      const categories =
        await adminFortuneService.listCategories(
          userId
        );

      const category =
        categories.find(
          (item) =>
            text ===
            `${item.id}️⃣ ${item.name_fa}`
        );

      if (!category) {
        await ctx.reply(
          "❌ دسته نامعتبر است. یکی از گزینه‌های منو را انتخاب کن.",
          categoryMenu(
            categories
          )
        );

        return;
      }

      setState(
        userId,
        {
          step: "title",
          categoryId:
            category.id,
          categoryName:
            category.name_fa,
          createdAt:
            state.createdAt,
        }
      );

      await ctx.reply(
        `📖 دسته: ${category.name_fa}\n\n` +
          "عنوان فال را ارسال کن.\n" +
          "اگر عنوان نمی‌خواهی، «ندارد» بفرست."
      );

      return;
    }

    if (
      state.step ===
      "title"
    ) {
      const title =
        text === "ندارد"
          ? null
          : text;

      setState(
        userId,
        {
          ...state,
          step: "content",
          title,
        }
      );

      await ctx.reply(
        "📝 متن کامل فال را ارسال کن."
      );

      return;
    }

    if (
      state.step ===
      "content"
    ) {
      if (!text) {
        await ctx.reply(
          "❌ متن فال نمی‌تواند خالی باشد."
        );

        return;
      }

      const fortune =
        await adminFortuneService.createManualFortune(
          {
            telegramUserId:
              userId,
            categoryId:
              state.categoryId,
            title:
              state.title,
            content:
              text,
          }
        );

      clearState(
        userId
      );

      await ctx.reply(
        "✅ فال با موفقیت ثبت شد.\n\n" +
          `📂 دسته: ${state.categoryName}\n` +
          `🆔 شماره: ${fortune.id}\n\n` +
          "از منوی مدیریت می‌توانی فال دیگری اضافه کنی.",
        menu()
      );

      return;
    }

    clearState(
      userId
    );

    await ctx.reply(
      "❌ وضعیت عملیات نامعتبر بود.",
      menu()
    );
  } catch (error) {
    console.error(
      "Admin fortune text failed:",
      error
    );

    clearState(
      userId
    );

    await ctx.reply(
      "❌ ذخیره فال انجام نشد.",
      menu()
    );
  }
}

async function handleStats(
  ctx
) {
  try {
    await adminFortuneService.requireFortunePermission(
      ctx.from.id
    );

    const categories =
      await adminFortuneService.listCategories(
        ctx.from.id
      );

    const lines = [];

    for (
      const category of categories
    ) {
      const count =
        await adminFortuneService.countFortunes(
          ctx.from.id,
          category.id
        );

      lines.push(
        `${category.name_fa}: ${count}`
      );
    }

    await ctx.reply(
      "📊 آمار فال‌ها\n\n" +
        (
          lines.length
            ? lines.join("\n")
            : "هنوز فالی ثبت نشده است."
        ),
      menu()
    );
  } catch (error) {
    console.error(
      "Fortune stats failed:",
      error
    );

    await ctx.reply(
      "❌ دریافت آمار انجام نشد."
    );
  }
}

async function handleNotReady(
  ctx
) {
  try {
    await adminFortuneService.requireFortunePermission(
      ctx.from.id
    );

    await ctx.reply(
      "⏳ این بخش در مرحله بعد تکمیل می‌شود.",
      menu()
    );
  } catch {
    await ctx.reply(
      "⛔ دسترسی ندارید."
    );
  }
}

function createAdminFortuneHandler(
  bot
) {
  bot.hears(
    MENU_BUTTON,
    handleMenu
  );

  bot.hears(
    ADD_BUTTON,
    startManualAdd
  );

  bot.hears(
    IMPORT_BUTTON,
    handleNotReady
  );

  bot.hears(
    BANK_BUTTON,
    handleNotReady
  );

  bot.hears(
    STATS_BUTTON,
    handleStats
  );

  bot.on(
    "text",
    handleText
  );
}

module.exports = {
  createAdminFortuneHandler,
};
