const PLATFORM_PATTERNS = [
  {
    platform: "instagram",
    hosts: [
      "instagram.com",
      "www.instagram.com",
      "m.instagram.com",
    ],
  },
  {
    platform: "tiktok",
    hosts: [
      "tiktok.com",
      "www.tiktok.com",
      "vm.tiktok.com",
      "vt.tiktok.com",
    ],
  },
  {
    platform: "youtube",
    hosts: [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "music.youtube.com",
      "youtu.be",
      "www.youtube-nocookie.com",
    ],
  },
  {
    platform: "facebook",
    hosts: [
      "facebook.com",
      "www.facebook.com",
      "fb.watch",
    ],
  },
  {
    platform: "x",
    hosts: [
      "x.com",
      "www.x.com",
      "twitter.com",
      "www.twitter.com",
    ],
  },
  {
    platform: "pinterest",
    hosts: [
      "pinterest.com",
      "www.pinterest.com",
      "pin.it",
    ],
  },
  {
    platform: "reddit",
    hosts: ["reddit.com", "www.reddit.com", "old.reddit.com", "redd.it", "www.redd.it"],
  },
  {
    platform: "soundcloud",
    hosts: ["soundcloud.com", "www.soundcloud.com", "m.soundcloud.com", "on.soundcloud.com"],
  },
  {
    platform: "twitch",
    hosts: ["twitch.tv", "www.twitch.tv", "clips.twitch.tv"],
  },
  {
    platform: "vimeo",
    hosts: ["vimeo.com", "www.vimeo.com", "player.vimeo.com"],
  },
  {
    platform: "dailymotion",
    hosts: ["dailymotion.com", "www.dailymotion.com", "dai.ly"],
  },
  {
    platform: "snapchat",
    hosts: ["snapchat.com", "www.snapchat.com", "story.snapchat.com"],
  },
  {
    platform: "threads",
    hosts: ["threads.net", "www.threads.net"],
  },
];

const INSTAGRAM_CONTENT_TYPES = {
  REEL: "REEL",
  STORY: "STORY",
  POST: "POST",
  PROFILE: "PROFILE",
  OTHER: "OTHER",
};

function cleanInput(value) {
  if (typeof value !== "string") {
    return null;
  }

  let result = value.trim();

  if (!result) {
    return null;
  }

  const markdownMatch = result.match(
    /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/
  );

  if (markdownMatch) {
    result = markdownMatch[2];
  }

  result = result.replace(/^[\"']+|[\"']+$/g, "");

  result = result.trim();

  return result || null;
}

function normalizeUrl(input) {
  const cleaned = cleanInput(input);

  if (!cleaned) {
    return null;
  }

  try {
    const url = new URL(
      /^https?:\/\//i.test(cleaned)
        ? cleaned
        : `https://${cleaned}`
    );

    url.hash = "";

    return url.toString();
  } catch {
    return null;
  }
}

function detectPlatform(input) {
  const normalizedUrl = normalizeUrl(input);

  if (!normalizedUrl) {
    return null;
  }

  const url = new URL(normalizedUrl);
  const hostname = url.hostname.toLowerCase();

  for (const item of PLATFORM_PATTERNS) {
    if (item.hosts.includes(hostname)) {
      return item.platform;
    }
  }

  return null;
}

function detectInstagramContentType(input) {
  const normalizedUrl = normalizeUrl(input);

  if (!normalizedUrl) {
    return null;
  }

  const url = new URL(normalizedUrl);
  const hostname = url.hostname.toLowerCase();

  const instagramHosts = [
    "instagram.com",
    "www.instagram.com",
    "m.instagram.com",
  ];

  if (!instagramHosts.includes(hostname)) {
    return null;
  }

  const parts = url.pathname
    .split("/")
    .filter(Boolean);

  if (parts.length === 0) {
    return INSTAGRAM_CONTENT_TYPES.OTHER;
  }

  const firstPart = parts[0].toLowerCase();

  if (firstPart === "reel" || firstPart === "reels") {
    return INSTAGRAM_CONTENT_TYPES.REEL;
  }

  if (firstPart === "stories" || firstPart === "story") {
    return INSTAGRAM_CONTENT_TYPES.STORY;
  }

  if (firstPart === "p") {
    return INSTAGRAM_CONTENT_TYPES.POST;
  }

  if (
    firstPart === "accounts" ||
    firstPart === "explore" ||
    firstPart === "direct" ||
    firstPart === "about" ||
    firstPart === "developer"
  ) {
    return INSTAGRAM_CONTENT_TYPES.OTHER;
  }

  return INSTAGRAM_CONTENT_TYPES.PROFILE;
}

function parseUrl(input) {
  const normalizedUrl = normalizeUrl(input);

  if (!normalizedUrl) {
    return {
      valid: false,
      url: null,
      platform: null,
      contentType: null,
    };
  }

  const platform = detectPlatform(normalizedUrl);

  let contentType = "OTHER";

  if (platform === "instagram") {
    contentType =
      detectInstagramContentType(normalizedUrl) ||
      INSTAGRAM_CONTENT_TYPES.OTHER;
  }

  return {
    valid: true,
    url: normalizedUrl,
    platform,
    contentType,
  };
}

module.exports = {
  normalizeUrl,
  detectPlatform,
  detectInstagramContentType,
  parseUrl,
  INSTAGRAM_CONTENT_TYPES,
};
