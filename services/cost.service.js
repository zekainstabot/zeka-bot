const DEFAULT_COST = 2;

// قیمت هر دانلود بر اساس پلتفرم و نوع محتوای قابل تشخیص از لینک
const PLATFORM_COSTS = {
  instagram: {
    REEL: 2,
    VIDEO: 2,
    STORY: 2,
    PHOTO: 1,
    POST: 1,
    PROFILE: 1,
    OTHER: 1,
  },
  youtube: { VIDEO: 3, AUDIO: 2, OTHER: 3 },
  tiktok: { PHOTO: 1, VIDEO: 2, AUDIO: 2, OTHER: 2 },
  facebook: { PHOTO: 1, VIDEO: 2, AUDIO: 2, OTHER: 2 },
  x: { PHOTO: 1, VIDEO: 2, AUDIO: 2, OTHER: 2 },
  pinterest: { PHOTO: 1, VIDEO: 1, OTHER: 1 },
  reddit: { PHOTO: 1, VIDEO: 2, AUDIO: 2, OTHER: 2 },
  soundcloud: { AUDIO: 2, OTHER: 2 },
  twitch: { VIDEO: 3, AUDIO: 2, OTHER: 3 },
  vimeo: { VIDEO: 3, AUDIO: 2, OTHER: 3 },
  dailymotion: { VIDEO: 2, AUDIO: 2, OTHER: 2 },
  snapchat: { PHOTO: 1, VIDEO: 2, OTHER: 2 },
  threads: { PHOTO: 1, VIDEO: 2, OTHER: 2 },
};

function normalizeContentType(contentType) {
  if (!contentType) return "OTHER";
  return String(contentType).trim().toUpperCase();
}

function normalizePlatform(platform) {
  if (!platform) return null;
  return String(platform).trim().toLowerCase();
}

function getDownloadCost(contentType, platform) {
  const normalizedType = normalizeContentType(contentType);
  const normalizedPlatform = normalizePlatform(platform);
  const platformCosts = PLATFORM_COSTS[normalizedPlatform];

  if (platformCosts) {
    if (platformCosts[normalizedType] !== undefined) {
      return platformCosts[normalizedType];
    }

    if (platformCosts.OTHER !== undefined) {
      return platformCosts.OTHER;
    }
  }

  // سازگاری با درخواست‌های قدیمی و پلتفرم‌های ناشناخته
  if (normalizedType === "PHOTO" || normalizedType === "PROFILE") return 1;
  if (normalizedType === "AUDIO") return 2;
  if (normalizedType === "VIDEO" || normalizedType === "REEL") return 2;
  if (normalizedType === "STORY") return 2;
  return DEFAULT_COST;
}

module.exports = {
  PLATFORM_COSTS,
  normalizeContentType,
  getDownloadCost,
};
