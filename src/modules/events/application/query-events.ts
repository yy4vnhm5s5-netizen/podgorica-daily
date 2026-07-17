import type { CityEvent, EventCategory, EventStatus } from "../domain/event.ts";
import type { CityContext } from "@/shared/types/city";

type EventSort = "category" | "newestSourceUpdate" | "soonest" | "venue";

interface EventQuery {
  categories?: readonly EventCategory[];
  cityId?: CityContext["city"]["id"];
  dateRange?: { end: string; start: string };
  free?: boolean;
  language?: CityEvent["language"];
  period?: "currentWeek" | "today" | "tomorrow" | "weekend";
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
  const cityId = query.cityId ?? context.city.id;
  const boundaries = getPeriodBoundaries(query.period, context.timezone, now);
  const requestedRange = query.dateRange
    ? { end: query.dateRange.end, start: query.dateRange.start }
    : boundaries;

  return events
    .filter((event) => event.cityIds.includes(cityId))
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
      query.period === "weekend" ? isWeekendEvent(event, context.timezone) : true,
    )
    .sort(createEventComparator(sort));
}

function getPeriodBoundaries(period: EventQuery["period"], timezone: string, now: Date) {
  if (!period) return undefined;
  const local = getLocalDate(now, timezone);
  const today = new Date(`${local}T00:00:00.000Z`);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  if (period === "today") return { end: local, start: local };
  if (period === "tomorrow") {
    const date = toDateString(tomorrow);
    return { end: date, start: date };
  }

  const dayOfWeek = today.getUTCDay() || 7;
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() - dayOfWeek + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return { end: toDateString(sunday), start: toDateString(monday) };
}

function isWeekendEvent(event: CityEvent, timezone: string) {
  const date = getEventLocalDate(event, timezone);
  if (!date) return false;
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  if (weekday === 6 || weekday === 0) return true;
  if (weekday !== 5 || !event.startsAt) return false;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: timezone })
      .formatToParts(new Date(event.startsAt))
      .find((part) => part.type === "hour")?.value,
  );
  return hour >= 18;
}

function intersectsDateRange(
  event: CityEvent,
  range: { end: string; start: string },
  timezone: string,
) {
  const date = getEventLocalDate(event, timezone);
  return date !== undefined && date >= range.start && date <= range.end;
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

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
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
