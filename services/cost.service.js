const COSTS = {
  REEL: 1,
  VIDEO: 1,
  STORY: 0.9,
  PHOTO: 0.8,
  PROFILE: 0.8,
  OTHER: 0.7,
  RANDOM: 2,
};

function normalizeContentType(contentType) {
  if (!contentType) {
    return "OTHER";
  }

  return String(contentType).trim().toUpperCase();
}

function getDownloadCost(contentType) {
  const normalizedType = normalizeContentType(contentType);

  return COSTS[normalizedType] ?? COSTS.OTHER;
}

module.exports = {
  COSTS,
  normalizeContentType,
  getDownloadCost,
};
