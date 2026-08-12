import { getLocaleTag, type Locale } from "../../../shared/config/locale.ts";
import { formatDateTime } from "../../../shared/lib/date.ts";

import type { GoingOutEvent } from "../domain/going-out-event.ts";
import { getLocalIsoDate, selectUpcomingGoingOutEvents } from "../domain/going-out-event.ts";
import type { GoingOutCacheState } from "../infrastructure/montegigs-going-out.ts";
import type { City } from "@/shared/types/city";
import { isDatePreset, matchesDatePreset, type DatePreset } from "@/shared/lib/date-preset";

type GoingOutDisplayState = "empty" | "events" | "stale" | "unavailable";
type GoingOutDatePreset = DatePreset;
type GoingOutListingState = GoingOutDisplayState | "filteredEmpty";

interface GoingOutUiFilters {
  datePreset: GoingOutDatePreset;
}

function getGoingOutDisplayState({
  eventCount,
  state,
}: {
  eventCount: number;
  state: GoingOutCacheState;
}): GoingOutDisplayState {
  if (eventCount > 0) return state === "stale" ? "stale" : "events";
  return state === "unavailable" ? "unavailable" : "empty";
}

function getGoingOutListingState({
  datePreset,
  filteredEventCount,
  snapshotEventCount,
  upcomingEventCount,
  state,
}: {
  datePreset: GoingOutDatePreset;
  filteredEventCount: number;
  snapshotEventCount: number;
  state: GoingOutCacheState;
  upcomingEventCount: number;
}): GoingOutListingState {
  const displayState = getGoingOutDisplayState({ eventCount: upcomingEventCount, state });
  if (filteredEventCount > 0 || displayState === "unavailable") return displayState;
  return datePreset !== "upcoming" && snapshotEventCount > 0 ? "filteredEmpty" : "empty";
}

function getHomepageGoingOutEvents(events: readonly GoingOutEvent[], now = new Date()) {
  return getAvailableGoingOutEvents(events, now).slice(0, 6);
}

function getAvailableGoingOutEvents(events: readonly GoingOutEvent[], now = new Date()) {
  return selectUpcomingGoingOutEvents(events, now);
}

// The dedicated /[city]/izlasci listing shows every upcoming record we retain. It used to reuse a
// 30-item cap that suited a compact surface, which silently hid listings once a city passed it
// (Budva: 32 upcoming at source, 30 rendered). Volume is bounded upstream instead — the collector
// refuses a MonteGigs response over maximumResponseLength — so no second numeric cap is invented
// here. Preview surfaces keep their own explicit small limits.
function getGoingOutPageEvents(events: readonly GoingOutEvent[], now = new Date()) {
  return selectUpcomingGoingOutEvents(events, now);
}

function filterGoingOutPageEvents(
  events: readonly GoingOutEvent[],
  filters: GoingOutUiFilters,
  now = new Date(),
  timeZone = "Europe/Podgorica",
) {
  return getGoingOutPageEvents(events, now).filter((event) =>
    matchesDatePreset({
      date: event.startDate,
      now,
      preset: filters.datePreset,
      startsAt: event.startsAt,
      timeZone,
    }),
  );
}

function parseGoingOutUiFilters(searchParams: Record<string, string | string[] | undefined>) {
  return {
    datePreset: isDatePreset(searchParams.period) ? searchParams.period : "upcoming",
  } satisfies GoingOutUiFilters;
}

interface GoingOutDateGroup {
  date: string;
  events: readonly GoingOutEvent[];
}

// Every MonteGigs record carries a startDate (the domain rejects one without it), so the whole
// upcoming list groups cleanly by calendar day. Order is preserved from the already-sorted input
// rather than re-sorted, and no day is invented: a day appears only if a listing falls on it.
function groupGoingOutEventsByDate(events: readonly GoingOutEvent[]): readonly GoingOutDateGroup[] {
  const groups = new Map<string, GoingOutEvent[]>();

  for (const event of events) {
    const group = groups.get(event.startDate);
    if (group) group.push(event);
    else groups.set(event.startDate, [event]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, groupedEvents]) => ({ date, events: groupedEvents }));
}

// The heading is always the calendar date; when that date is today in Podgorica it is additionally
// marked rather than replaced, so "tomorrow" still reads as a date and the marker cannot mislead.
// "Today" is decided by the same helper that decides which listings count as upcoming, so the two
// can never disagree, and the route renders per request (revalidate = 0) so this is request time
// and never build time.
function formatGoingOutDateHeading(date: string, locale: Locale, now = new Date()) {
  const label = formatDateTime(new Date(`${date}T12:00:00.000Z`), {
    formatOptions: { dateStyle: "full", timeStyle: undefined },
    locale: getLocaleTag(locale),
  }).label;
  if (!label) return label;
  if (date === getLocalIsoDate(now)) return `${locale === "me" ? "Danas" : "Today"} — ${label}`;
  return `${label[0].toLocaleUpperCase(getLocaleTag(locale))}${label.slice(1)}`;
}

// The grouped /izlasci card sits under a day heading that already states the date, so it shows
// only the clock time when the source gave one. Returns undefined when there is no verified time —
// the card then renders the venue alone rather than a placeholder.
function formatGoingOutTime(event: GoingOutEvent, locale: Locale) {
  if (!event.startsAt) return undefined;
  return formatDateTime(new Date(event.startsAt), {
    formatOptions: { dateStyle: undefined, timeStyle: "short" },
    locale: getLocaleTag(locale),
  }).label;
}

function formatGoingOutSchedule(event: GoingOutEvent, locale: Locale) {
  const date = formatDateTime(new Date(`${event.startDate}T12:00:00.000Z`), {
    formatOptions: { dateStyle: "medium", timeStyle: undefined },
    locale: getLocaleTag(locale),
  }).label;
  if (!event.startsAt) return date;
  const time = formatDateTime(new Date(event.startsAt), {
    formatOptions: { dateStyle: undefined, timeStyle: "short" },
    locale: getLocaleTag(locale),
  }).label;
  return `${date} · ${time}`;
}

// Addresses are source facts, but a bare city name adds no context beside the dedicated city
// field. This comparison is intentionally narrow: only equivalent trimmed, case-insensitive city
// labels disappear; street addresses that happen to include the city remain visible.
function getGoingOutDetailAddress(address: string | undefined, city: City) {
  if (!address || normalizeComparableAddress(address) === normalizeComparableAddress(city.name)) {
    return undefined;
  }

  return address;
}

function normalizeComparableAddress(value: string) {
  return value.replace(/\s+/gu, " ").trim().toLocaleLowerCase("sr-Latn-ME");
}

export {
  formatGoingOutDateHeading,
  formatGoingOutSchedule,
  formatGoingOutTime,
  filterGoingOutPageEvents,
  getGoingOutDetailAddress,
  getAvailableGoingOutEvents,
  getGoingOutDisplayState,
  getGoingOutListingState,
  getGoingOutPageEvents,
  getHomepageGoingOutEvents,
  groupGoingOutEventsByDate,
  parseGoingOutUiFilters,
  type GoingOutDateGroup,
  type GoingOutDatePreset,
  type GoingOutDisplayState,
  type GoingOutListingState,
  type GoingOutUiFilters,
};
