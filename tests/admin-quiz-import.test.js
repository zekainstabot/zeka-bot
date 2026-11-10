const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseQuestionBlocks,
  normalizeCorrectOptionIndex,
} = require("../services/admin-quiz-import.service");

test("rejects missing or invalid correct answer indexes", () => {
  for (const value of [null, undefined, "", -1, 4, "x"]) {
    assert.equal(normalizeCorrectOptionIndex(value), null);
  }
});

test("accepts only the four valid correct answer indexes", () => {
  assert.deepEqual(
    [0, 1, 2, 3].map(normalizeCorrectOptionIndex),
    [0, 1, 2, 3]
  );
});

test("parses Persian question numbering and option labels", () => {
  const html = [
    "<p>۱. پایتخت ایران کدام شهر است؟</p>",
    "<p>الف) شیراز</p>",
    "<p>ب) تهران ✅</p>",
    "<p>ج) تبریز</p>",
    "<p>د) اصفهان</p>",
  ].join("");

  const questions = parseQuestionBlocks(html);

  assert.equal(questions.length, 1);
  assert.equal(questions[0].sourceNumber, 1);
  assert.equal(questions[0].correctOption, 1);
  assert.deepEqual(questions[0].options, [
    "شیراز",
    "تهران",
    "تبریز",
    "اصفهان",
  ]);
});

test("does not guess an answer when no option is marked correct", () => {
  const html = [
    "<p>2. پایتخت فرانسه کدام شهر است؟</p>",
    "<p>A) رم</p>",
    "<p>B) پاریس</p>",
    "<p>C) برلین</p>",
    "<p>D) مادرید</p>",
  ].join("");

  const questions = parseQuestionBlocks(html);

  assert.equal(questions.length, 1);
  assert.equal(questions[0].correctOption, null);
  assert.equal(
    normalizeCorrectOptionIndex(questions[0].correctOption),
    null
  );
});

test("rejects a question when multiple options are marked correct", () => {
  const html = [
    "<p>3. نمونه سؤال؟</p>",
    "<p>A) گزینه اول ✅</p>",
    "<p>B) گزینه دوم ✓</p>",
    "<p>C) گزینه سوم</p>",
    "<p>D) گزینه چهارم</p>",
  ].join("");

  const questions = parseQuestionBlocks(html);

  assert.equal(questions.length, 1);
  assert.equal(questions[0].correctOption, null);
});
