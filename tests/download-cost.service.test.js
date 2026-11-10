const test = require("node:test");
const assert = require("node:assert/strict");
const { getDownloadCost } = require("../services/cost.service");

test("download costs use the approved platform pricing", () => {
  const cases = [
    ["instagram", "REEL", 2],
    ["instagram", "POST", 1],
    ["instagram", "AUDIO", 1],
    ["youtube", "OTHER", 3],
    ["youtube", "AUDIO", 2],
    ["tiktok", "OTHER", 2],
    ["facebook", "PHOTO", 1],
    ["x", "OTHER", 2],
    ["pinterest", "OTHER", 1],
    ["reddit", "OTHER", 2],
    ["soundcloud", "OTHER", 2],
    ["twitch", "OTHER", 3],
    ["vimeo", "OTHER", 3],
    ["dailymotion", "OTHER", 2],
    ["snapchat", "OTHER", 2],
    ["threads", "PHOTO", 1],
  ];

  for (const [platform, contentType, expected] of cases) {
    assert.equal(
      getDownloadCost(contentType, platform),
      expected,
      `${platform} / ${contentType}`
    );
  }
});

test("unknown platform falls back to safe default costs", () => {
  assert.equal(getDownloadCost("PHOTO", "unknown"), 1);
  assert.equal(getDownloadCost("VIDEO", "unknown"), 2);
  assert.equal(getDownloadCost("AUDIO", "unknown"), 2);
});
