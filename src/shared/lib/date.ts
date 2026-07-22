import { getLocaleTag, type Locale } from "../config/locale.ts";

const defaultLocale = getLocaleTag("me");
const defaultTimeZone = "Europe/Podgorica";

interface FormatDateTimeOptions {
  formatOptions?: Intl.DateTimeFormatOptions;
  locale?: string;
  timeZone?: string;
}

interface LocalDateTime {
  date: string;
  time?: string;
}

function formatDateTime(value: Date, options: FormatDateTimeOptions = {}) {
  const { formatOptions, locale = defaultLocale, timeZone = defaultTimeZone } = options;

  return {
    dateTime: value.toISOString(),
    label: new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
      ...formatOptions,
    }).format(value),
  };
}

function getHourInTimeZone(value: Date, timeZone = defaultTimeZone) {
  const hour = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    hour12: false,
    timeZone,
  })
    .formatToParts(value)
    .find(({ type }) => type === "hour")?.value;

  return hour ? Number.parseInt(hour, 10) : 0;
}

function toZonedIso(local: LocalDateTime, timeZone = defaultTimeZone): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(local.date) || !local.time || !/^\d{2}:\d{2}$/.test(local.time)) {
    return undefined;
  }

  const [year, month, day] = local.date.split("-").map(Number);
  const [hour, minute] = local.time.split(":").map(Number);
  if (hour > 23 || minute > 59) return undefined;
  const provisional = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = getTimeZoneOffset(provisional, timeZone);
  const adjusted = provisional - firstOffset;
  const finalOffset = getTimeZoneOffset(adjusted, timeZone);

  return new Date(provisional - finalOffset).toISOString();
}

function getTimeZoneOffset(timestamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const zonedTimestamp = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return zonedTimestamp - timestamp;
}

function formatRelativeTime(value: Date, { locale, now }: { locale: Locale; now: Date }) {
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - value.getTime()) / 1_000));
  if (elapsedSeconds < 60) return locale === "me" ? "upravo" : "just now";

  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return formatRelativeUnit(minutes, "minute", locale);

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatRelativeUnit(hours, "hour", locale);

  return formatRelativeUnit(Math.floor(hours / 24), "day", locale);
}

function formatRelativeUnit(value: number, unit: "day" | "hour" | "minute", locale: Locale) {
  if (locale === "en") {
    return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
  }

  const labels = {
    day: getBcsPlural(value, "dan", "dana", "dana"),
    hour: getBcsPlural(value, "sat", "sata", "sati"),
    minute: getBcsPlural(value, "minut", "minuta", "minuta"),
  } as const;
  return `prije ${value} ${labels[unit]}`;
}

function getBcsPlural(value: number, singular: string, few: string, many: string) {
  const modulo100 = value % 100;
  const modulo10 = value % 10;
  if (modulo100 >= 11 && modulo100 <= 14) return many;
  if (modulo10 === 1) return singular;
  if (modulo10 >= 2 && modulo10 <= 4) return few;
  return many;
}

export {
  defaultTimeZone,
  formatDateTime,
  formatRelativeTime,
  getHourInTimeZone,
  toZonedIso,
  type FormatDateTimeOptions,
  type LocalDateTime,
};
