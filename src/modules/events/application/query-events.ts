import type { CityEvent, EventCategory, EventStatus } from "../domain/event.ts";
import type { CityContext } from "@/shared/types/city";
import { getDatePresetRange, isDateWithinRange, isWeekendDate } from "@/shared/lib/date-preset";

type EventSort = "category" | "newestSourceUpdate" | "soonest" | "venue";

interface EventQuery {
  categories?: readonly EventCategory[];
  dateRange?: { end: string; start: string };
  free?: boolean;
  language?: CityEvent["language"];
  period?: "currentWeek" | "today" | "tomorrow" | "upcoming" | "weekend";
  sourceId?: string;
  statuses?: readonly EventStatus[];
  venueId?: string;
}

function queryEvents(
  events: readonly CityEvent[],
  context: CityContext,
  query: EventQuery = {},
  now = new Date(),
  sort: EventSort = "soonest",
) {
  const cityId = context.city.id;
  const boundaries = query.period
    ? getDatePresetRange(query.period, context.timezone, now)
    : undefined;
  const requestedRange = query.dateRange
    ? { end: query.dateRange.end, start: query.dateRange.start }
    : boundaries;

  return events
    .filter((event) => event.cityId === cityId)
    .filter((event) => (query.categories ? query.categories.includes(event.category) : true))
    .filter((event) => (query.free === undefined ? true : event.isFree === query.free))
    .filter((event) => (query.language ? event.language === query.language : true))
    .filter((event) => (query.sourceId ? event.sourceId === query.sourceId : true))
    .filter((event) => (query.statuses ? query.statuses.includes(event.status) : true))
    .filter((event) => (query.venueId ? event.venueId === query.venueId : true))
    .filter((event) =>
      requestedRange ? intersectsDateRange(event, requestedRange, context.timezone) : true,
    )
    .filter((event) =>
      query.period === "weekend"
        ? isWeekendDate(
            getEventLocalDate(event, context.timezone) ?? "",
            event.startsAt,
            context.timezone,
          )
        : true,
    )
    .sort(createEventComparator(sort));
}

function intersectsDateRange(
  event: CityEvent,
  range: { end?: string; start: string },
  timezone: string,
) {
  const date = getEventLocalDate(event, timezone);
  return date !== undefined && isDateWithinRange(date, range);
}

function getEventLocalDate(event: CityEvent, timezone: string) {
  if (event.startDate) return event.startDate;
  if (!event.startsAt) return undefined;
  return getLocalDate(new Date(event.startsAt), timezone);
}

function getLocalDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function createEventComparator(sort: EventSort) {
  return (left: CityEvent, right: CityEvent) => {
    if (sort === "category") return left.category.localeCompare(right.category);
    if (sort === "venue") return (left.venueName ?? "").localeCompare(right.venueName ?? "");
    if (sort === "newestSourceUpdate") {
      return (right.sourceUpdatedAt ?? "").localeCompare(left.sourceUpdatedAt ?? "");
    }
    return (left.startsAt ?? left.startDate ?? "").localeCompare(
      right.startsAt ?? right.startDate ?? "",
    );
  };
}

export { queryEvents, type EventQuery, type EventSort };
