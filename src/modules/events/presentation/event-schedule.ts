import type { CityEvent } from "../domain/event.ts";
import { getLocaleTag, type Locale } from "@/shared/config/locale";
import { defaultTimeZone, formatDateTime } from "@/shared/lib/date";

// A cached event's date fields are not guaranteed to be a valid, parseable date (see
// sanitizeCachedEventDates in events-cache.ts for the primary defense at the read boundary).
// This is a second, narrow guard at the exact point a Date is constructed and formatted, so an
// unexpected malformed value degrades to omitting that detail instead of throwing during render.
function getValidDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// TEMPORARY diagnostic label + logging for the event-detail "Invalid option : option" incident.
// Remove this helper and its call sites once the failing construction is confirmed in logs.
const endsAtDirectDiagnosticLabel = "event-schedule:endsAt-direct";

function formatEventSchedule(event: CityEvent, locale: Locale) {
  const startsAt = getValidDate(event.startsAt);
  if (startsAt) {
    const startsAtLabel = formatDateTime(startsAt, {
      diagnosticEventId: event.id,
      diagnosticLabel: "event-schedule:startsAt",
      locale: getLocaleTag(locale),
    }).label;
    const endsAt = getValidDate(event.endsAt);
    if (!endsAt) return startsAtLabel;

    const endsAtOptions: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: defaultTimeZone,
    };
    console.info(
      JSON.stringify({
        diagnostic: "intl-datetimeformat-construct",
        eventId: event.id,
        label: endsAtDirectDiagnosticLabel,
        locale: getLocaleTag(locale),
        options: endsAtOptions,
      }),
    );
    let endsAtLabel: string;
    try {
      endsAtLabel = new Intl.DateTimeFormat(getLocaleTag(locale), endsAtOptions).format(endsAt);
    } catch (error) {
      console.error(
        JSON.stringify({
          diagnostic: "intl-datetimeformat-failed",
          errorMessage: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : "UnknownError",
          eventId: event.id,
          label: endsAtDirectDiagnosticLabel,
          locale: getLocaleTag(locale),
          options: endsAtOptions,
        }),
      );
      throw error;
    }
    return `${startsAtLabel} – ${endsAtLabel}`;
  }

  const startDate = event.startDate ? getValidDate(`${event.startDate}T12:00:00.000Z`) : undefined;
  return startDate
    ? formatDateTime(startDate, {
        diagnosticEventId: event.id,
        diagnosticLabel: "event-schedule:startDate-only",
        formatOptions: { dateStyle: "medium", timeStyle: undefined },
        locale: getLocaleTag(locale),
      }).label
    : undefined;
}

export { formatEventSchedule, getValidDate };
