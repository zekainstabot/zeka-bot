"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeSearchText,
  scoreTrack,
  isAllowedLicense,
  normalizeSearchEntry,
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

test("normalizes YouTube search entries into validated track candidates", () => {
  const track = normalizeSearchEntry({
    id: "abc123",
    title: "Song Name",
    uploader: "Singer",
    duration: 210,
  }, "youtube");
  assert.equal(track.title, "Song Name");
  assert.equal(track.artist, "Singer");
  assert.equal(track.url, "https://www.youtube.com/watch?v=abc123");
  assert.equal(track.source, "YouTube");
});

test("rejects untrusted URLs returned by platform search", () => {
  assert.equal(normalizeSearchEntry({
    title: "Fake result",
    webpage_url: "https://evil.example/song",
  }, "youtube"), null);
  assert.equal(normalizeSearchEntry({
    title: "Fake result",
    webpage_url: "http://soundcloud.com/artist/song",
  }, "soundcloud"), null);
});

test("accepts a valid SoundCloud result", () => {
  const track = normalizeSearchEntry({
    title: "Track",
    uploader: "Artist",
    webpage_url: "https://soundcloud.com/artist/track",
  }, "soundcloud");
  assert.equal(track.source, "SoundCloud");
  assert.equal(track.artist, "Artist");
});
