import { getHourInTimeZone } from "./date.ts";

type DatePreset = "today" | "tomorrow" | "upcoming" | "weekend";
type DatePeriod = "currentWeek" | DatePreset;

interface LocalDateRange {
  end?: string;
  start: string;
}

interface DatePresetMatchInput {
  date: string;
  now?: Date;
  preset: DatePreset;
  startsAt?: string;
  timeZone: string;
}

// Shared calendar semantics for the public Događaji and Izlasci listings. The weekend begins at
// 18:00 on Friday only when the source supplied a verified start time, then includes Saturday and
// Sunday. This intentionally mirrors the existing Events definition rather than guessing a time
// for date-only records.
function getDatePresetRange(
  preset: DatePeriod,
  timeZone: string,
  now = new Date(),
): LocalDateRange {
  const today = getLocalIsoDate(now, timeZone);
  if (preset === "today") return { end: today, start: today };

  const tomorrow = addCalendarDays(today, 1);
  if (preset === "tomorrow") return { end: tomorrow, start: tomorrow };
  if (preset === "upcoming") return { start: today };

  const localDay = new Date(`${today}T00:00:00.000Z`);
  const dayOfWeek = localDay.getUTCDay() || 7;
  const monday = addCalendarDays(today, -dayOfWeek + 1);
  return { end: addCalendarDays(monday, 6), start: monday };
}

function matchesDatePreset({
  date,
  now = new Date(),
  preset,
  startsAt,
  timeZone,
}: DatePresetMatchInput) {
  const range = getDatePresetRange(preset, timeZone, now);
  if (!isDateWithinRange(date, range)) return false;
  return preset !== "weekend" || isWeekendDate(date, startsAt, timeZone);
}

function isDateWithinRange(date: string, range: LocalDateRange) {
  return date >= range.start && (range.end === undefined || date <= range.end);
}

function isWeekendDate(date: string, startsAt: string | undefined, timeZone: string) {
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  if (weekday === 6 || weekday === 0) return true;
  return (
    weekday === 5 && startsAt !== undefined && getHourInTimeZone(new Date(startsAt), timeZone) >= 18
  );
}

function isDatePreset(value: unknown): value is DatePreset {
  return value === "today" || value === "tomorrow" || value === "weekend" || value === "upcoming";
}

function getLocalIsoDate(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(value);
  const byType = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function addCalendarDays(date: string, amount: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export {
  getDatePresetRange,
  getLocalIsoDate,
  isDatePreset,
  isDateWithinRange,
  isWeekendDate,
  matchesDatePreset,
  type DatePreset,
  type DatePeriod,
  type DatePresetMatchInput,
  type LocalDateRange,
};
