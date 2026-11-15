const TIMEOUT = 10 * 60 * 1000;
function createMusicSearchHandler({ bot }) {
  const sessions = new Map();
  const ask = async (ctx) => {
    sessions.set(String(ctx.from.id), Date.now());
    await ctx.reply("🎵 جست‌وجوی موسیقی\n\nنام آهنگ و خواننده، فقط نام آهنگ یا چند کلمه از متن ترانه را بفرست.\nبرای خروج «🔙 بازگشت» را بزن.");
  };
  async function getJson(url) {
    const res = await fetch(url, { headers: { "User-Agent": "ZekaBot/1.0" }, signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error("Provider HTTP " + res.status);
    return res.json();
  }
  async function itunes(term) {
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", term); url.searchParams.set("entity", "song"); url.searchParams.set("limit", "5");
    const data = await getJson(url);
    return Array.isArray(data.results) ? data.results : [];
  }
  bot.hears("🎵 جست‌وجوی موسیقی", ask);
  bot.on("text", async (ctx, next) => {
    const id = String(ctx.from.id), started = sessions.get(id);
    if (!started) return next();
    const q = String(ctx.message.text || "").trim();
    if (q === "🔙 بازگشت" || q === "🛠 امکانات ویژه") { sessions.delete(id); return next(); }
    if (Date.now() - started > TIMEOUT) { sessions.delete(id); await ctx.reply("⏱ زمان جست‌وجو تمام شد؛ دوباره از امکانات ویژه وارد شو."); return; }
    if (q.length < 2) { await ctx.reply("نام آهنگ یا بخشی از متن ترانه را بفرست."); return; }
    await ctx.reply("🔎 در حال جست‌وجوی آهنگ...");
    try {
      let lyrics = [];
      if (q.split(/\s+/).length >= 3) {
        try { const u = new URL("https://lrclib.net/api/search"); u.searchParams.set("q", q); const data = await getJson(u); lyrics = Array.isArray(data) ? data.slice(0, 3) : []; }
        catch (e) { console.warn("Lyrics lookup:", e.message); }
      }
      let found = [];
      if (lyrics.length) {
        for (const item of lyrics) {
          const term = [item.artistName, item.trackName].filter(Boolean).join(" ");
          if (term) { try { found.push(...await itunes(term)); } catch (e) { console.warn(e.message); } }
        }
      } else found = await itunes(q);
      const unique = [...new Map(found.map(x => [String(x.trackId || x.trackName), x])).values()].slice(0, 5);
      if (!unique.length && !lyrics.length) { await ctx.reply("❌ نتیجه‌ای پیدا نشد. نام خواننده یا عبارت دیگری را امتحان کن."); sessions.set(id, Date.now()); return; }
      for (const item of unique) {
        const title = item.trackName || "آهنگ", artist = item.artistName || "هنرمند نامشخص";
        const keyboard = [];
        if (item.trackViewUrl) keyboard.push([{ text: "🍎 Apple Music", url: item.trackViewUrl }]);
        keyboard.push([{ text: "🟢 جست‌وجو در Spotify", url: "https://open.spotify.com/search/" + encodeURIComponent(title + " " + artist) }]);
        const caption = "🎵 " + title + "\n👤 " + artist + (item.collectionName ? "\n💿 " + item.collectionName : "");
        if (item.previewUrl) {
          try { await ctx.replyWithAudio(item.previewUrl, { title, performer: artist, caption: caption + "\n\n🎧 پیش‌نمایش کوتاه", reply_markup: { inline_keyboard: keyboard } }); }
          catch (e) { console.warn("Preview send failed:", e.message); await ctx.reply(caption + "\nپیش‌نمایش قابل ارسال نبود.", { reply_markup: { inline_keyboard: keyboard } }); }
        } else await ctx.reply(caption + "\nپیش‌نمایش در دسترس نیست.", { reply_markup: { inline_keyboard: keyboard } });
      }
      if (lyrics.length) await ctx.reply("📝 آهنگ‌های نزدیک به متن ارسالی:\n" + lyrics.map(x => (x.trackName || "نامشخص") + " — " + (x.artistName || "نامشخص")).join("\n"));
      await ctx.reply("برای جست‌وجوی بعدی، عبارت دیگری بفرست یا «🔙 بازگشت» را بزن.");
      sessions.set(id, Date.now());
    } catch (e) { console.error("Music search failed:", e.message); await ctx.reply("❌ جست‌وجوی موسیقی فعلاً انجام نشد. کمی بعد دوباره امتحان کن."); sessions.set(id, Date.now()); }
  });
}
module.exports = { createMusicSearchHandler };
