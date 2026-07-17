import { getLocaleTag } from "@/shared/config/locale";

const defaultLocale = getLocaleTag("me");
const defaultTimeZone = "Europe/Podgorica";

interface FormatDateTimeOptions {
  formatOptions?: Intl.DateTimeFormatOptions;
  locale?: string;
  timeZone?: string;
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

export { defaultTimeZone, formatDateTime, getHourInTimeZone, type FormatDateTimeOptions };
