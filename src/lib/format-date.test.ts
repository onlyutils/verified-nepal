import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatBsDate, formatDate, formatDateline, formatDateTime, formatMonth, formatRelativeTime } from "./format-date.ts";
import { BS_MONTHS_EN, BS_MONTHS_NE, toBikramSambat, toDevanagariDigits } from "./bs-calendar.ts";

describe("date formatters", () => {
  it("return an empty string for missing or invalid dates", () => {
    for (const value of [undefined, null, "not-a-date", Number.NaN, new Date("invalid")]) {
      assert.doesNotThrow(() => formatDateTime(value, "en"));
      assert.equal(formatDateTime(value, "en"), "");
      assert.equal(formatMonth(value, "en"), "");
    }
  });

  it("formats valid dates", () => {
    assert.match(formatDateTime("2026-01-02T03:04:00.000Z", "en"), /2026.*NPT/);
    assert.match(formatMonth("2026-01-02T03:04:00.000Z", "en"), /2026/);
  });
});

const DAY = 86_400_000;
const NOW = new Date("2026-10-14T06:00:00Z");

describe("relative time", () => {
  it("formats eleven hours ago in both languages", () => {
    const value = new Date(NOW.getTime() - 11 * 60 * 60 * 1000);
    assert.match(formatRelativeTime(value, "en", NOW), /11 hours ago/);
    assert.match(formatRelativeTime(value, "ne", NOW), /११.*घण्टा/);
  });

  it("uses just now for less than a minute in either direction", () => {
    for (const offset of [-59_999, 0, 59_999]) {
      assert.equal(formatRelativeTime(NOW.getTime() + offset, "en", NOW), "just now");
      assert.equal(formatRelativeTime(NOW.getTime() + offset, "ne", NOW), "अहिले");
    }
  });

  it("uses the largest whole unit and numeric auto for past and future dates", () => {
    for (const [offset, expected] of [
      [-60_000, "1 minute ago"],
      [-3_599_999, "59 minutes ago"],
      [-3_600_000, "1 hour ago"],
      [-DAY + 1, "23 hours ago"],
      [-DAY, "yesterday"],
      [-2 * DAY, "2 days ago"],
      [-30 * DAY, "30 days ago"],
      [60_000, "in 1 minute"],
      [3_600_000, "in 1 hour"],
      [DAY, "tomorrow"],
      [30 * DAY, "in 30 days"],
    ] as const) {
      assert.equal(formatRelativeTime(NOW.getTime() + offset, "en", NOW), expected);
    }
  });

  it("falls back to a Kathmandu absolute date strictly beyond thirty days", () => {
    for (const offset of [-40 * DAY, -30 * DAY - 1, 30 * DAY + 1, 40 * DAY]) {
      const value = NOW.getTime() + offset;
      assert.equal(formatRelativeTime(value, "en", NOW), formatDate(value, "en"));
      assert.match(formatRelativeTime(value, "en", NOW), /2026/);
      assert.match(formatRelativeTime(value, "ne", NOW), /२०२६/);
      assert.doesNotMatch(formatRelativeTime(value, "en", NOW), /NPT|\d:\d/);
    }
  });

  it("returns empty for invalid inputs or an invalid reference clock", () => {
    for (const value of [null, undefined, "", "invalid", NaN, Infinity, new Date(NaN)]) {
      assert.equal(formatRelativeTime(value, "en", NOW), "");
      assert.equal(formatRelativeTime(value, "ne", NOW), "");
    }
    assert.equal(formatRelativeTime(NOW, "en", new Date(NaN)), "");
  });
});

describe("Bikram Sambat calendar", () => {
  for (const [civilDate, year, month, day] of [
    ["2026-10-14", 2083, 6, 28],
    ["2026-08-26", 2083, 5, 10],
    ["2024-04-13", 2081, 1, 1],
    ["2025-04-14", 2082, 1, 1],
  ] as const) {
    it(`converts the supplied ${civilDate} fixture`, () => {
      const date = new Date(`${civilDate}T00:00:00+05:45`);
      const timestamp = date.getTime();
      assert.deepEqual(toBikramSambat(date), { year, month, day });
      assert.equal(date.getTime(), timestamp);
    });
  }

  it("handles every new year and its neighbouring days across the table", () => {
    // Independent boundary fixtures from nepali-datetime's published calendar_bs.csv.
    // Each row is [BS year, Gregorian Baisakh 1, previous Chaitra's last day].
    const newYears = [
      [2070, "2013-04-14", null],
      [2071, "2014-04-14", 30],
      [2072, "2015-04-14", 30],
      [2073, "2016-04-13", 30],
      [2074, "2017-04-14", 31],
      [2075, "2018-04-14", 30],
      [2076, "2019-04-14", 30],
      [2077, "2020-04-13", 30],
      [2078, "2021-04-14", 31],
      [2079, "2022-04-14", 30],
      [2080, "2023-04-14", 30],
      [2081, "2024-04-13", 30],
      [2082, "2025-04-14", 31],
      [2083, "2026-04-14", 30],
      [2084, "2027-04-14", 30],
      [2085, "2028-04-13", 30],
      [2086, "2029-04-14", 30],
      [2087, "2030-04-14", 30],
      [2088, "2031-04-15", 30],
      [2089, "2032-04-14", 30],
      [2090, "2033-04-14", 30],
      [2091, "2034-04-14", 30],
      [2092, "2035-04-15", 30],
      [2093, "2036-04-14", 30],
      [2094, "2037-04-14", 30],
      [2095, "2038-04-14", 30],
    ] as const;

    for (const [year, civilDate, previousLastDay] of newYears) {
      const start = new Date(`${civilDate}T00:00:00+05:45`).getTime();
      assert.deepEqual(toBikramSambat(new Date(start)), { year, month: 1, day: 1 });
      assert.deepEqual(toBikramSambat(new Date(start + DAY)), { year, month: 1, day: 2 });
      for (const offset of [-DAY, -1]) {
        if (previousLastDay === null) {
          assert.throws(() => toBikramSambat(new Date(start + offset)), RangeError);
        } else {
          assert.deepEqual(toBikramSambat(new Date(start + offset)), {
            year: year - 1,
            month: 12,
            day: previousLastDay,
          });
        }
      }
    }
  });

  it("uses Kathmandu midnight rather than UTC or the host time zone", () => {
    assert.deepEqual(toBikramSambat(new Date("2026-10-13T18:14:59.999Z")), {
      year: 2083,
      month: 6,
      day: 27,
    });
    assert.deepEqual(toBikramSambat(new Date("2026-10-13T18:15:00Z")), {
      year: 2083,
      month: 6,
      day: 28,
    });
  });

  it("includes all of the last supported day and rejects dates outside the table", () => {
    assert.deepEqual(toBikramSambat(new Date("2039-04-14T23:59:59.999+05:45")), {
      year: 2095,
      month: 12,
      day: 30,
    });
    for (const value of ["2000-01-01", "2039-04-15T00:00:00+05:45", "2100-01-01", "invalid", "-002026-10-14T00:00:00Z"]) {
      assert.throws(() => toBikramSambat(new Date(value)), RangeError);
    }
  });

  it("exports the requested month names and converts digits without grouping", () => {
    assert.deepEqual(BS_MONTHS_NE, ["बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज", "कात्तिक", "मंसिर", "पुष", "माघ", "फागुन", "चैत"]);
    assert.deepEqual(BS_MONTHS_EN, [
      "Baisakh",
      "Jestha",
      "Asar",
      "Shrawan",
      "Bhadra",
      "Asoj",
      "Kartik",
      "Mangsir",
      "Poush",
      "Magh",
      "Falgun",
      "Chaitra",
    ]);
    assert.equal(toDevanagariDigits(2083), "२०८३");
    assert.equal(toDevanagariDigits("0123456789"), "०१२३४५६७८९");
    assert.equal(toDevanagariDigits(-28.5), "-२८.५");
    assert.equal(toDevanagariDigits("असोज 28, २०८३"), "असोज २८, २०८३");
  });
});

describe("BS date and dateline formatters", () => {
  it("formats the supplied dates in English and Nepali", () => {
    for (const value of [NOW, NOW.toISOString(), NOW.getTime()]) {
      assert.equal(formatBsDate(value, "en"), "Asoj 28, 2083");
      assert.equal(formatBsDate(value, "ne"), "असोज २८, २०८३");
    }
    assert.equal(formatBsDate("2026-08-26T00:00:00+05:45", "ne"), "भदौ १०, २०८३");
    assert.equal(formatBsDate("2024-04-13T00:00:00+05:45", "en"), "Baisakh 1, 2081");
    assert.equal(formatBsDate("2025-04-14T00:00:00+05:45", "en"), "Baisakh 1, 2082");
    assert.equal(formatBsDate("2024-04-13T00:00:00+05:45", "ne"), "वैशाख १, २०८१");
    assert.equal(formatBsDate("2025-04-14T00:00:00+05:45", "ne"), "वैशाख १, २०८२");
  });

  it("formats a full dateline with matching Kathmandu dates in both calendars", () => {
    assert.equal(formatDateline(NOW, "en"), "Wednesday, Asoj 28, 2083 (14 Oct 2026)");
    assert.equal(formatDateline(NOW, "ne"), "बुधबार, असोज २८, २०८३ (१४ अक्टोबर २०२६)");
    assert.equal(formatDateline("2026-10-13T18:15:00Z", "en"), formatDateline(NOW, "en"));
    assert.equal(formatDate("2026-12-31T18:15:00Z", "en"), "1 Jan 2027");
  });

  it("returns empty for missing or invalid inputs in either language", () => {
    for (const format of [formatDate, formatBsDate, formatDateline]) {
      for (const language of ["en", "ne"] as const) {
        for (const value of [undefined, null, "", "invalid", NaN, Infinity, new Date(NaN)]) {
          assert.equal(format(value, language), "");
        }
      }
    }
  });

  it("propagates out-of-table errors only for BS formatting", () => {
    for (const value of ["2000-01-01", "2040-01-01"]) {
      for (const language of ["en", "ne"] as const) {
        assert.throws(() => formatBsDate(value, language), RangeError);
        assert.throws(() => formatDateline(value, language), RangeError);
        assert.notEqual(formatDate(value, language), "");
      }
    }
  });
});
