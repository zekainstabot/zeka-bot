const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyDownloadError,
  getDownloadErrorMessage,
} = require("../services/download-error.service");

test("classifies download timeouts", () => {
  assert.equal(
    classifyDownloadError(new Error("The operation timed out")),
    "DOWNLOAD_TIMEOUT"
  );
});

test("classifies Instagram rate limits", () => {
  assert.equal(
    classifyDownloadError(new Error("HTTP Error 429: Too Many Requests")),
    "INSTAGRAM_RATE_LIMITED"
  );
});

test("classifies explicit IP restrictions", () => {
  assert.equal(
    classifyDownloadError(new Error("Your IP address has been blocked")),
    "INSTAGRAM_IP_BLOCKED"
  );
});

test("classifies invalid Instagram URLs", () => {
  assert.equal(
    classifyDownloadError(new Error("Unsupported URL")),
    "INVALID_INSTAGRAM_URL"
  );
});

test("classifies private content separately from login-required content", () => {
  assert.equal(
    classifyDownloadError(new Error("This account is private")),
    "INSTAGRAM_PRIVATE_CONTENT"
  );
  assert.equal(
    classifyDownloadError(new Error("Login required")),
    "INSTAGRAM_LOGIN_REQUIRED"
  );
});

test("prefers a recognized explicit error code", () => {
  const error = new Error("Generic failure");
  error.code = "DOWNLOAD_TIMEOUT";

  assert.equal(classifyDownloadError(error), "DOWNLOAD_TIMEOUT");
});

test("returns a safe Persian fallback for unknown codes", () => {
  assert.match(getDownloadErrorMessage("UNKNOWN_CODE"), /دانلود/);
});
