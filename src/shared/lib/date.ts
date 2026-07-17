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

export { defaultTimeZone, formatDateTime, type FormatDateTimeOptions };
