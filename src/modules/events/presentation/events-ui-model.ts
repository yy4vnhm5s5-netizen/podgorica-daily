import type { EventProviderReadState } from "../application/get-city-events.ts";
import type { CityEvent } from "../domain/event.ts";
import { queryEvents, type EventSort } from "../application/query-events.ts";
import {
  getDomainCategories,
  isEventPresentationCategory,
  type EventPresentationCategory,
} from "./event-presentation-category.ts";
import type { CityContext } from "@/shared/types/city";

type EventDatePreset = "today" | "tomorrow" | "upcoming" | "weekend";

interface EventsUiFilters {
  category?: EventPresentationCategory;
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
    category: isEventPresentationCategory(searchParams.category)
      ? searchParams.category
      : undefined,
    datePreset: isEventDatePreset(searchParams.period) ? searchParams.period : "upcoming",
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
  const matchingEvents = queryEvents(
    events,
    context,
    {
      categories: filters.category ? getDomainCategories(filters.category) : undefined,
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
  if (datePreset === "tomorrow") return "tomorrow";
  if (datePreset === "weekend") return "weekend";
  return "upcoming";
}

function selectHomepageEvents(events: readonly CityEvent[], context: CityContext, now = new Date()) {
  return queryEvents(
    events,
    context,
    { period: "upcoming", statuses: ["active", "scheduled"] },
    now,
  )
    .filter((event) => isCurrentOrFutureEvent(event, now, context.timezone))
    .slice(0, 3);
}

function isHomepageEventsUnavailable(providers: readonly Pick<EventProviderReadState, "state">[]) {
  return providers.length > 0 && providers.every((provider) => provider.state === "unavailable");
}

function isCurrentOrFutureEvent(event: CityEvent, now: Date, timeZone: string) {
  if (event.startsAt) {
    const startsAt = new Date(event.startsAt);
    if (startsAt >= now) return true;

    return event.status === "active" && (!event.endsAt || new Date(event.endsAt) >= now);
  }

  return Boolean(event.startDate && event.startDate >= getLocalDate(now, timeZone));
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

function isEventDatePreset(value: unknown): value is EventDatePreset {
  return value === "today" || value === "tomorrow" || value === "weekend" || value === "upcoming";
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
  isHomepageEventsUnavailable,
  parseEventsUiFilters,
  selectHomepageEvents,
  type EventDatePreset,
  type EventDayGroup,
  type EventsUiFilters,
};
