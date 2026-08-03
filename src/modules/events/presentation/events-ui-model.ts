import type { EventProviderReadState } from "../application/get-city-events.ts";
import type { CityEvent } from "../domain/event.ts";
import { hasEventEnded, type EventLifecycleOptions } from "../domain/event-lifecycle.ts";
import { queryEvents, type EventSort } from "../application/query-events.ts";
import { getEventsTranslations } from "./events-translations.ts";
import {
  getDomainCategories,
  isEventPresentationCategory,
  type EventPresentationCategory,
} from "./event-presentation-category.ts";
import { getCityName } from "@/shared/config/cities";
import type { Locale } from "@/shared/config/locale";
import type { City, CityContext } from "@/shared/types/city";

type EventDatePreset = "today" | "tomorrow" | "upcoming" | "weekend";
type EventDetailStatusTone = "cancelled" | "ended" | "postponed";

const genericHomepageVenueNames = new Set(["grad", "online", "podgorica", "tba"]);

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

function getCityEventsForPublicListing(events: readonly CityEvent[]) {
  return events.filter((event) => event.category !== "movie" && !isCineplexxProgrammeEvent(event));
}

function getPublicCityEventById(events: readonly CityEvent[], eventId: string) {
  return getCityEventsForPublicListing(events).find((event) => event.id === eventId);
}

// The <title> for an event detail page. Provider titles carry no city context of their own, which
// left every event page competing without the local signal its own URL already has. The city is
// appended unless the title already names it in one of its registry forms — matched on word
// boundaries so a substring ("Barok" for Bar) is not mistaken for a mention. Visible title/H1 are
// deliberately untouched; this only affects metadata.
function getEventDetailPageTitle(event: CityEvent, city: City) {
  const cityForms = new Set([
    getCityName(city),
    getCityName(city, "locative"),
    getCityName(city, "accusative"),
  ]);
  const mentionsCity = [...cityForms].some((form) =>
    new RegExp(`(^|\\P{L})${escapeRegExpLiteral(form)}(\\P{L}|$)`, "iu").test(event.title),
  );

  return mentionsCity ? event.title : `${event.title} — ${getCityName(city)}`;
}

function escapeRegExpLiteral(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// One status line for the detail page. Provider-declared states win, because "otkazano" and
// "odgođeno" are facts the source asserted about the event and outrank anything the clock implies.
// Otherwise the ended notice is derived from the event's own dates against an injected `now` —
// never from the snapshot's frozen `status`, which still says "scheduled" for an event that was
// upcoming when the snapshot was written.
function getEventDetailStatusNotice(
  event: CityEvent,
  locale: Locale,
  options: EventLifecycleOptions,
): { label: string; tone: EventDetailStatusTone } | undefined {
  const { status } = getEventsTranslations(locale);
  if (event.status === "cancelled" || event.status === "postponed") {
    return { label: status[event.status], tone: event.status };
  }

  return hasEventEnded(event, options) ? { label: status.ended, tone: "ended" } : undefined;
}

function isCineplexxProgrammeEvent(event: CityEvent) {
  return (
    event.sourceId === "cineplexx-podgorica" ||
    event.sourceReferences.some(
      ({ sourceId, sourceUrl }) => sourceId === "cineplexx-podgorica" || isCineplexxUrl(sourceUrl),
    ) ||
    isCineplexxUrl(event.sourceUrl)
  );
}

function isCineplexxUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "cineplexx.me" || url.hostname === "www.cineplexx.me";
  } catch {
    return false;
  }
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

function getHomepageEvents(events: readonly CityEvent[], context: CityContext, now = new Date()) {
  return queryEvents(
    events,
    context,
    { period: "upcoming", statuses: ["active", "scheduled"] },
    now,
  ).filter((event) => isCurrentOrFutureEvent(event, now, context.timezone));
}

function getHomepageEventsTodayCount(
  events: readonly CityEvent[],
  timeZone: string,
  now = new Date(),
) {
  const today = getLocalDate(now, timeZone);
  return events.filter((event) => {
    const eventDate =
      event.startDate ??
      (event.startsAt ? getLocalDate(new Date(event.startsAt), timeZone) : undefined);
    return eventDate === today;
  }).length;
}

function selectHomepageEvents(
  events: readonly CityEvent[],
  context: CityContext,
  now = new Date(),
) {
  return getHomepageEvents(events, context, now).slice(0, 3);
}

function getHomepageVenueName(value: string | undefined) {
  const venueName = value?.replace(/\s+/g, " ").trim();
  if (!venueName || venueName.length < 3 || /^[\p{Ll}]/u.test(venueName)) return undefined;

  return genericHomepageVenueNames.has(venueName.toLocaleLowerCase()) ? undefined : venueName;
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
  getCityEventsForPublicListing,
  getEventDetailPageTitle,
  getEventDetailStatusNotice,
  getPublicCityEventById,
  getHomepageEvents,
  getHomepageEventsTodayCount,
  getHomepageVenueName,
  groupEventsByDay,
  isHomepageEventsUnavailable,
  parseEventsUiFilters,
  selectHomepageEvents,
  type EventDatePreset,
  type EventDayGroup,
  type EventDetailStatusTone,
  type EventsUiFilters,
};
