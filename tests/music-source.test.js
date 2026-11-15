"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeSearchText,
  scoreTrack,
  isAllowedLicense,
} = require("../services/music-source.service");

test("normalizes Persian and Arabic character variants", () => {
  assert.equal(normalizeSearchText("كیفیتِ صدا"), normalizeSearchText("کیفیت صدا"));
  assert.equal(normalizeSearchText("می‌روم"), normalizeSearchText("می روم"));
});

test("scores title and artist matches above unrelated tracks", () => {
  const wanted = { title: "دلم گرفته", artist: "ابی", query: "دلم گرفته ابی" };
  const matching = scoreTrack({ title: "دلم گرفته", artist: "Ebi" }, wanted.title, wanted.artist, wanted.query);
  const unrelated = scoreTrack({ title: "بارون", artist: "خواننده دیگر" }, wanted.title, wanted.artist, wanted.query);
  assert.ok(matching > unrelated);
});

test("accepts redistributable CC licenses but rejects non-commercial licenses", () => {
  assert.equal(isAllowedLicense("https://creativecommons.org/licenses/by/4.0/"), true);
  assert.equal(isAllowedLicense("https://creativecommons.org/licenses/by-sa/3.0/"), true);
  assert.equal(isAllowedLicense("https://creativecommons.org/licenses/by-nc-sa/4.0/"), false);
});
