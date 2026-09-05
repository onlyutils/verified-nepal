import { test } from "node:test";
import assert from "node:assert/strict";
import { CURRENT_DISASTER } from "./disasters.ts";
import {
  coverRect,
  disasterLine,
  EMPTY_POSTER,
  isPosterResolved,
  lastSeenLine,
  personLine,
  posterFilename,
  posterHeadline,
  validatePoster,
  wrapText,
  type PosterStrings,
} from "./poster.ts";

const t: PosterStrings = {
  headlineMissing: "MISSING",
  headlineFound: "FOUND",
  headlineSafe: "SAFE",
  since: "Missing since the {disaster}",
  sinceFound: "Reported missing after the {disaster}",
  lastSeen: "Last seen",
  age: "Age",
  gender: "Gender",
  marks: "Marks",
  contact: "Contact",
  nickname: "also called",
  woman: "Woman",
  man: "Man",
  girl: "Girl",
  boy: "Boy",
  other: "Other",
  brandUrl: "verifiednepal.com",
};
const base = {
  ...EMPTY_POSTER,
  name: "Sita Tamang",
  district: "Rasuwa",
  place: "Betrawati",
  phones: ["9841000000", ""] as [string, string],
};

test("disaster line names the disaster, date and district", () => {
  assert.equal(disasterLine(CURRENT_DISASTER, "Rasuwa", "en", t), "Missing since the Bhote Koshi flash flood · 26 August 2026 · Rasuwa");
  assert.equal(disasterLine(CURRENT_DISASTER, "", "en", t, "found"), "Reported missing after the Bhote Koshi flash flood · 26 August 2026");
});

test("person line joins name, nickname, age and gender", () => {
  assert.equal(personLine({ ...base, nickname: "Situ", age: "34", gender: "woman" }, t), "Sita Tamang (Situ) · Age 34 · Woman");
  assert.equal(personLine(base, t), "Sita Tamang");
});

test("last seen line joins place, district and time", () => {
  assert.equal(lastSeenLine({ ...base, lastSeenAt: "2026-08-26T14:30" }, t), "Last seen: Betrawati, Rasuwa · 26 Aug 2026, 14:30");
  assert.equal(lastSeenLine(base, t), "Last seen: Betrawati, Rasuwa");
  assert.equal(lastSeenLine(base, t, false), "Betrawati, Rasuwa");
});

test("found and safe both resolve the search; missing does not", () => {
  assert.equal(isPosterResolved("missing"), false);
  assert.equal(isPosterResolved("found"), true);
  assert.equal(isPosterResolved("safe"), true);
  assert.equal(posterHeadline("safe", t), "SAFE");
});

test("wrapText breaks on words, caps lines and adds an ellipsis", () => {
  const measure = (s: string) => s.length * 10;
  assert.deepEqual(wrapText(measure, "one two three four", 90, 3), ["one two", "three", "four"]);
  assert.deepEqual(wrapText(measure, "one two three four five", 90, 2), ["one two", "three…"]);
  assert.deepEqual(wrapText(measure, "", 90, 2), []);
});

test("coverRect crops the longer side, centred", () => {
  assert.deepEqual(coverRect(2000, 1000, 500, 500), { sx: 500, sy: 0, sw: 1000, sh: 1000 });
  assert.deepEqual(coverRect(1000, 2000, 500, 500), { sx: 0, sy: 500, sw: 1000, sh: 1000 });
});

test("filename is slugged and sized", () => {
  assert.equal(posterFilename({ ...base, size: "story" }), "missing-sita-tamang-story.png");
  assert.equal(posterFilename({ ...base, name: "सीता तामाङ", status: "found" }), "found-poster-feed.png");
});

test("validatePoster flags the required fields", () => {
  assert.deepEqual(validatePoster(EMPTY_POSTER), { name: true, district: true, place: true, phones: true });
  assert.deepEqual(validatePoster({ ...base, phones: ["12", ""] }), { phones: true });
  assert.deepEqual(validatePoster(base), {});
});
