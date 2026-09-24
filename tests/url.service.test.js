const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeUrl,
  detectPlatform,
  parseUrl,
} = require("../services/url.service");

test("normalizeUrl adds https when protocol is missing", () => {
  const result = normalizeUrl(
    "www.instagram.com/reel/ABC123/"
  );

  assert.equal(
    result,
    "https://www.instagram.com/reel/ABC123/"
  );
});

test("normalizeUrl removes hash", () => {
  const result = normalizeUrl(
    "https://www.instagram.com/p/ABC123/#test"
  );

  assert.equal(
    result,
    "https://www.instagram.com/p/ABC123/"
  );
});

test("detectPlatform detects Instagram", () => {
  assert.equal(
    detectPlatform(
      "https://www.instagram.com/reel/ABC123/"
    ),
    "instagram"
  );
});

test("detectPlatform detects supported platforms", () => {
  assert.equal(
    detectPlatform("https://www.tiktok.com/@user/video/123"),
    "tiktok"
  );

  assert.equal(
    detectPlatform("https://www.youtube.com/watch?v=abc"),
    "youtube"
  );

  assert.equal(
    detectPlatform("https://www.facebook.com/watch/?v=123"),
    "facebook"
  );

  assert.equal(
    detectPlatform("https://x.com/user/status/123"),
    "x"
  );

  assert.equal(
    detectPlatform("https://pin.it/abc123"),
    "pinterest"
  );
});

test("detectPlatform returns null for unsupported domains", () => {
  assert.equal(
    detectPlatform("https://example.com/test"),
    null
  );
});

test("parseUrl returns valid Instagram result", () => {
  const result = parseUrl(
    "https://www.instagram.com/p/ABC123/"
  );

  assert.equal(result.valid, true);
  assert.equal(result.platform, "instagram");
  assert.equal(
    result.url,
    "https://www.instagram.com/p/ABC123/"
  );
});

test("parseUrl rejects invalid URLs", () => {
  const result = parseUrl("not a valid url");

  assert.equal(result.valid, false);
  assert.equal(result.url, null);
  assert.equal(result.platform, null);
});

test("parseUrl accepts URLs without protocol", () => {
  const result = parseUrl(
    "www.instagram.com/reel/ABC123/"
  );

  assert.equal(result.valid, true);
  assert.equal(result.platform, "instagram");
});
