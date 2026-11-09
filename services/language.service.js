"use strict";
const userRepository = require("../repositories/user.repository");
const BUTTONS = {
"📥 دانلود":"📥 Download","🎟 ثبت کد هدیه":"🎟 Redeem Gift Code","🎁 جوایز دریافتی من":"🎁 My Rewards","👥 دعوت دوستان":"👥 Invite Friends","🎯 مأموریت‌ها":"🎯 Missions","👤 حساب من":"👤 My Account","🎁 هدایا":"🎁 Gifts","⭐ زکا پرو":"⭐ Zeka Pro","🌐 اتصال به زکا مدیا":"🌐 Connect to Zeka Media","🛠 امکانات ویژه":"🛠 Special Features","💬 ارتباط با پشتیبانی":"💬 Contact Support","📊 اعتبار من":"📊 My Credits","🏆 سطح و XP":"🏆 Level & XP","🌐 زبان":"🌐 Language","👤 اطلاعات حساب":"👤 Account Information","🔙 بازگشت":"🔙 Back","🎡 گردونه شانس":"🎡 Lucky Wheel","🧠 مسابقه":"🧠 Quiz","❌ لغو مسابقه":"❌ Cancel Quiz","🔄 تغییر کد اتصال":"🔄 Change Connection Code","📖 فال حافظ":"📖 Hafez Fortune","❤️ فال عشق":"❤️ Love Fortune","🌙 فال روزانه":"🌙 Daily Fortune","💰 فال مالی":"💰 Finance Fortune","🎯 فال نیت":"🎯 Intention Fortune","🔮 فال":"🔮 Fortune","📜 فال حافظ":"📜 Hafez Fortune"
};
const TEXT = {
"🏠 منوی اصلی":"🏠 Main Menu","سلام ":"Hello ", "به زکا خوش آمدی.":"Welcome to Zeka.","به زکا خوش آمدی.":"Welcome to Zeka.","از منوی پایین، بخش موردنظرت را انتخاب کن.":"Choose a section from the menu below.","👤 حساب من":"👤 My Account","👤 نام":"👤 Name","عنوان:":"Title:","سطح فعلی:":"Current level:","عنوان":"Title","امتیاز باقی‌مانده:":"XP remaining:","پیشرفت:":"Progress:","دریافت XP":"Earned XP","نام:":"Name:","شناسه:":"ID:","شماره پیگیری:":"Tracking number:","وضعیت:":"Status:","لینک منبع:":"Source link:","نوع فایل:":"File type:","فایل:":"File:","موجود":"Available","در دسترس نیست":"Unavailable","ثبت نشده":"Not set","🆔 شناسه":"🆔 ID","💳 اعتبار":"💳 Credits","🏆 سطح":"🏆 Level","🔥 روزهای فعال متوالی":"🔥 Active streak","⭐ فعال":"⭐ Active","❌ فعال نیست":"❌ Inactive","📊 اعتبار من":"📊 My Credits","🔄 رول‌اور":"🔄 Rollover","📅 اعتبار روزانه":"📅 Daily credits","👥 اعتبار دعوت":"👥 Referral credits","💳 اعتبار خریداری‌شده":"💳 Purchased credits","➕ سایر اعتبارها":"➕ Other credits","💰 مجموع اعتبار":"💰 Total credits","ℹ️ مصرف اعتبار طبق اولویت سیستم زکا انجام می‌شود.":"ℹ️ Credits are consumed according to Zeka's priority system.","🏆 سطح و XP":"🏆 Level & XP","🎯 سطح بعدی":"🎯 Next level","✨ امتیاز باقی‌مانده":"✨ XP remaining","📈 پیشرفت":"📈 Progress","👑 به بالاترین سطح فعلی رسیده‌ای!":"👑 You have reached the highest available level!","🧾 آخرین تغییرات XP":"🧾 Recent XP activity","هنوز امتیاز XP دریافت نکرده‌ای.":"You haven't earned XP yet.","🎮 با پاسخ صحیح در مسابقه‌ها و دریافت جایزه XP از گردونه، امتیازت را افزایش بده.":"🎮 Earn XP by answering quiz questions correctly and winning XP on the wheel.","🌐 زبان":"🌐 Language","زبان را انتخاب کنید:":"Choose your language:","زبان با موفقیت به فارسی تغییر کرد.":"Language changed to Persian.","❌ دریافت اطلاعات حساب انجام نشد.":"❌ Could not load account information.","❌ دریافت اعتبار انجام نشد.":"❌ Could not load credits.","❌ دریافت اطلاعات سطح و XP انجام نشد.":"❌ Could not load level and XP information.","لطفاً دوباره تلاش کنید.":"Please try again.","👤 اطلاعات حساب":"👤 Account Information","🔹 نام کاربری":"🔹 Username","🆔 شناسه تلگرام":"🆔 Telegram ID","فعال":"Active","فعال نیست":"Inactive","📥 دانلود":"📥 Download","🎁 هدایا":"🎁 Gifts","🎡 گردونه شانس":"🎡 Lucky Wheel","🧠 مسابقه":"🧠 Quiz","🔙 بازگشت":"🔙 Back"
};
function translateText(value, language) {
 if(language!=="en"||typeof value!=="string") return value;
 let result=value;
 for(const [fa,en] of Object.entries(TEXT).sort((a,b)=>b[0].length-a[0].length)) result=result.split(fa).join(en);
 return result;
}
function translateMarkup(extra, language) {
 if(language!=="en"||!extra||typeof extra!=="object") return extra;
 const copy={...extra};
 if(copy.reply_markup){
  copy.reply_markup={...copy.reply_markup};
  if(Array.isArray(copy.reply_markup.keyboard)) copy.reply_markup.keyboard=copy.reply_markup.keyboard.map(row=>row.map(button=>typeof button==="string"?(BUTTONS[button]||button):button));
  if(Array.isArray(copy.reply_markup.inline_keyboard)) copy.reply_markup.inline_keyboard=copy.reply_markup.inline_keyboard.map(row=>row.map(button=>({...button,text:BUTTONS[button.text]||button.text})));
 }
 return copy;
}
async function getLanguage(id){
 if(!id)return "fa";
 try{const user=await userRepository.findByTelegramId(String(id));return user?.language==="en"?"en":"fa";}
 catch(error){console.error("Language lookup failed:",error.message);return "fa";}
}
async function setLanguage(id,language){
 if(!["fa","en"].includes(language))throw new Error("Unsupported language");
 const user=await userRepository.findByTelegramId(String(id));
 if(!user)throw new Error("User not found");
 const updated=await userRepository.updateByTelegramId(String(id),{language});
 return updated?.language||language;
}
function createLanguageMiddleware(){
 return async(ctx,next)=>{
  const language=await getLanguage(ctx.from?.id);
  ctx.state=ctx.state||{};ctx.state.language=language;
  const reply=ctx.reply.bind(ctx);
  ctx.reply=(message,extra)=>reply(translateText(message,language),translateMarkup(extra,language));
  if(language==="en"&&typeof ctx.message?.text==="string"){
   const found=Object.entries(BUTTONS).find(([,en])=>en===ctx.message.text);
   if(found)ctx.message.text=found[0];
  }
  return next();
 };
}
module.exports={BUTTONS,TEXT,getLanguage,setLanguage,translateText,translateMarkup,createLanguageMiddleware};
