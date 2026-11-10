const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeQuizLanguageCode,
} = require("../games/quiz/quiz.service");

test("normalizes English Telegram locale variants to English", () => {
  for (const locale of ["en", "en-US", "en-GB", "EN_us"]) {
    assert.equal(normalizeQuizLanguageCode(locale), "en");
  }
});

test("uses Persian for Persian and unsupported locales", () => {
  for (const locale of ["fa", "fa-IR", "de", "fr", "", null, undefined]) {
    assert.equal(normalizeQuizLanguageCode(locale), "fa");
  }
});
