import type { CityEvent, EventCategory } from "../domain/event.ts";
import { queryEvents, type EventSort } from "../application/query-events.ts";
import type { CityContext } from "@/shared/types/city";

type EventDatePreset = "all" | "next-seven-days" | "today" | "weekend";

interface EventsUiFilters {
  category?: EventCategory;
  datePreset: EventDatePreset;
  query?: string;
  sort: EventSort;
  sourceId?: string;
}

interface EventDayGroup {
  date: string;
  events: readonly CityEvent[];
}

function parseEventsUiFilters(
  searchParams: Record<string, string | string[] | undefined>,
): EventsUiFilters {
  return {
    category: isEventCategory(searchParams.category) ? searchParams.category : undefined,
    datePreset: isEventDatePreset(searchParams.period) ? searchParams.period : "all",
    query: getSearchParam(searchParams.query),
    sort: isEventSort(searchParams.sort) ? searchParams.sort : "soonest",
    sourceId: getSearchParam(searchParams.source),
  };
}

function filterEventsForUi(
  events: readonly CityEvent[],
  context: CityContext,
  filters: EventsUiFilters,
  now = new Date(),
) {
  const period = toEventQueryPeriod(filters.datePreset);
  const dateRange =
    filters.datePreset === "next-seven-days"
      ? getNextSevenDaysRange(now, context.timezone)
      : undefined;
  const matchingEvents = queryEvents(
    events,
    context,
    {
      categories: filters.category ? [filters.category] : undefined,
      dateRange,
      period,
      sourceId: filters.sourceId,
    },
    now,
    filters.sort,
  );
  const query = filters.query?.trim().toLocaleLowerCase(context.locale);

  if (!query) return matchingEvents;

  return matchingEvents.filter((event) =>
    [event.title, event.venueName, event.organizer, event.description]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase(context.locale).includes(query)),
  );
}

function groupEventsByDay(
  events: readonly CityEvent[],
  timeZone: string,
): readonly EventDayGroup[] {
  const groups = new Map<string, CityEvent[]>();

  for (const event of events) {
    const date =
      event.startDate ??
      (event.startsAt ? getLocalDate(new Date(event.startsAt), timeZone) : undefined);
    if (!date) continue;
    const group = groups.get(date) ?? [];
    group.push(event);
    groups.set(date, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, groupedEvents]) => ({ date, events: groupedEvents }));
}

function toEventQueryPeriod(datePreset: EventDatePreset) {
  if (datePreset === "today") return "today";
  if (datePreset === "weekend") return "weekend";
  return undefined;
}

function getNextSevenDaysRange(now: Date, timeZone: string) {
  const start = getLocalDate(now, timeZone);
  const endDate = new Date(`${start}T12:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 6);

  return { end: endDate.toISOString().slice(0, 10), start };
}

function getSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function getLocalDate(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isEventCategory(value: unknown): value is EventCategory {
  return typeof value === "string" && eventCategories.includes(value as EventCategory);
}

const eventCategories = [
  "concert",
  "festival",
  "theatre",
  "movie",
  "sport",
  "kids",
  "education",
  "conference",
  "market",
  "exhibition",
  "community",
  "government",
  "nightlife",
  "workshop",
  "literature",
  "other",
] as const;

function isEventDatePreset(value: unknown): value is EventDatePreset {
  return value === "all" || value === "today" || value === "weekend" || value === "next-seven-days";
}

function isEventSort(value: unknown): value is EventSort {
  return (
    value === "soonest" ||
    value === "category" ||
    value === "venue" ||
    value === "newestSourceUpdate"
  );
}

export {
  filterEventsForUi,
  groupEventsByDay,
  parseEventsUiFilters,
  type EventDatePreset,
  type EventDayGroup,
  type EventsUiFilters,
};
