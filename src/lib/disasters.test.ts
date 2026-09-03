import { test } from "node:test";
import assert from "node:assert/strict";
import { CURRENT_DISASTER, disasterDateLabel, disasterStart } from "./disasters.ts";
import { responseDay } from "./edition.ts";

test("current disaster is the Bhote Koshi flash flood", () => {
  assert.equal(CURRENT_DISASTER.id, "bhote-koshi-2026");
  assert.equal(CURRENT_DISASTER.kind, "flash-flood");
  assert.equal(CURRENT_DISASTER.date, "2026-08-26");
});

test("disasterStart is midnight Nepal time", () => {
  assert.equal(disasterStart(), Date.parse("2026-08-26T00:00:00+05:45"));
});

test("date label is bilingual", () => {
  assert.equal(disasterDateLabel(CURRENT_DISASTER, "en"), "26 August 2026");
  assert.match(disasterDateLabel(CURRENT_DISASTER, "ne"), /२०२६/);
});

test("edition day counts from the disaster start", () => {
  assert.equal(responseDay(new Date("2026-08-26T12:00:00+05:45")), 1);
  assert.equal(responseDay(new Date("2026-09-03T12:00:00+05:45")), 9);
});
