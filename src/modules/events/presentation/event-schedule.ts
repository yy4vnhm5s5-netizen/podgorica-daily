import type { CityEvent } from "../domain/event.ts";
import { getLocaleTag, type Locale } from "@/shared/config/locale";
import { formatDateTime } from "@/shared/lib/date";

// A cached event's date fields are not guaranteed to be a valid, parseable date (see
// sanitizeCachedEventDates in events-cache.ts for the primary defense at the read boundary).
// This is a second, narrow guard at the exact point a Date is constructed and formatted, so an
// unexpected malformed value degrades to omitting that detail instead of throwing during render.
function getValidDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatEventSchedule(event: CityEvent, locale: Locale) {
  const startsAt = getValidDate(event.startsAt);
  if (startsAt) {
    const startsAtLabel = formatDateTime(startsAt, { locale: getLocaleTag(locale) }).label;
    const endsAt = getValidDate(event.endsAt);
    if (!endsAt) return startsAtLabel;
    const endsAtLabel = formatDateTime(endsAt, {
      // dateStyle/timeStyle must be explicitly cleared here: Intl.DateTimeFormat throws a
      // TypeError if dateStyle/timeStyle are combined with individual component options
      // (hour, minute, etc.) in the same options object, and formatDateTime's own defaults
      // always include dateStyle/timeStyle unless a caller explicitly clears them. An event
      // with both a valid startsAt and a valid endsAt hit exactly this combination.
      formatOptions: { dateStyle: undefined, hour: "2-digit", minute: "2-digit", timeStyle: undefined },
      locale: getLocaleTag(locale),
    }).label;
    return `${startsAtLabel} – ${endsAtLabel}`;
  }

  const startDate = event.startDate ? getValidDate(`${event.startDate}T12:00:00.000Z`) : undefined;
  return startDate
    ? formatDateTime(startDate, {
        formatOptions: { dateStyle: "medium", timeStyle: undefined },
        locale: getLocaleTag(locale),
      }).label
    : undefined;
}

export { formatEventSchedule, getValidDate };
