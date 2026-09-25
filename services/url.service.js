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
      "youtu.be",
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
];

function cleanInput(value) {
  if (typeof value !== "string") {
    return null;
  }

  let result = value.trim();

  if (!result) {
    return null;
  }

  // Convert Markdown links:
  // [https://example.com](https://example.com)
  const markdownMatch = result.match(
    /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/
  );

  if (markdownMatch) {
    result = markdownMatch[2];
  }

  // Remove accidental surrounding quotes
  result = result.replace(/^["']+|["']+$/g, "");

  // Remove whitespace/newlines around URL
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

function parseUrl(input) {
  const normalizedUrl = normalizeUrl(input);

  if (!normalizedUrl) {
    return {
      valid: false,
      url: null,
      platform: null,
    };
  }

  return {
    valid: true,
    url: normalizedUrl,
    platform: detectPlatform(normalizedUrl),
  };
}

module.exports = {
  normalizeUrl,
  detectPlatform,
  parseUrl,
};
