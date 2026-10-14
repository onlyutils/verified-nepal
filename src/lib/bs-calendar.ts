export const BS_MONTHS_NE = ["बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज", "कात्तिक", "मंसिर", "पुष", "माघ", "फागुन", "चैत"] as const;

export const BS_MONTHS_EN = [
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
] as const;

// Month lengths, Baisakh through Chaitra, checked on 2026-10-14:
// Primary: https://github.com/amitgaru/nepali-datetime/blob/c668263100fa854531021b73d71b3a7180184971/nepali_datetime/data/calendar_bs.csv
// Comparison: https://gist.github.com/pradipchitrakar/2023ca88848cd21c78d25a8c8f2f624d/219dd8de92bc17047eb4156641c16a99d237e077
// The two published tables differ in BS 2081, 2082, 2083, 2087, 2092 and 2093.
// We consistently use the primary table, whose four supplied AD/BS fixtures agree.
// ponytail: This bounded table avoids calendar prediction; extend/reconcile it with
// newly published Nepali calendars and boundary fixtures before supporting later years.
const BS_MONTH_LENGTHS = [
  [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30], // 2070
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2071
  [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 2072
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31], // 2073
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], // 2074
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2075
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 2076
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2077
  [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], // 2078
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2079
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 2080
  [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 2081
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2082
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 2083
  [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30], // 2084
  [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30], // 2085
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2086
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 30, 30, 30], // 2087
  [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30], // 2088
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2089
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2090
  [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30], // 2091
  [30, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2092
  [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30], // 2093
  [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30], // 2094
  [31, 31, 32, 31, 31, 31, 30, 29, 30, 30, 30, 30], // 2095
] as const;

// BS 2070-01-01 = AD 2013-04-14, corroborated by:
// https://usemiti.com/month-dates/2070
// https://www.ashesh.com.np/nepali-calendar/nepali_calendar_2070_pdf.pdf (Baisakh)
const FIRST_BS_YEAR = 2070;
const ANCHOR_CIVIL_DAY = Date.UTC(2013, 3, 14);
const DAY_MS = 86_400_000;
const civilDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kathmandu",
  calendar: "gregory",
  numberingSystem: "latn",
  era: "short",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** Converts a Kathmandu civil date; invalid dates and dates outside BS 2070–2095 throw RangeError. */
export function toBikramSambat(date: Date): { year: number; month: number; day: number } {
  const parts = civilDateFormatter.formatToParts(date);
  if (parts.find((part) => part.type === "era")?.value !== "AD") {
    throw new RangeError("Date is outside the BS 2070–2095 calendar table");
  }
  const partNumber = (type: "year" | "month" | "day") => Number(parts.find((part) => part.type === type)!.value);
  // UTC is only an ordinal for the already extracted Kathmandu Y-M-D, not the input instant.
  const civilDay = Date.UTC(partNumber("year"), partNumber("month") - 1, partNumber("day"));
  let remainingDays = (civilDay - ANCHOR_CIVIL_DAY) / DAY_MS;
  if (remainingDays >= 0) {
    for (const [yearIndex, months] of BS_MONTH_LENGTHS.entries()) {
      for (const [monthIndex, length] of months.entries()) {
        if (remainingDays < length) {
          return { year: FIRST_BS_YEAR + yearIndex, month: monthIndex + 1, day: remainingDays + 1 };
        }
        remainingDays -= length;
      }
    }
  }
  throw new RangeError("Date is outside the BS 2070–2095 calendar table");
}

export function toDevanagariDigits(n: number | string): string {
  return String(n).replace(/[0-9]/g, (digit) => "०१२३४५६७८९"[Number(digit)]);
}
