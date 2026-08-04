import { getLocaleTag, type Locale } from "../../../shared/config/locale.ts";
import { formatDateTime } from "../../../shared/lib/date.ts";

import type { GoingOutEvent } from "../domain/going-out-event.ts";
import { selectUpcomingGoingOutEvents } from "../domain/going-out-event.ts";
import type { GoingOutCacheState } from "../infrastructure/montegigs-going-out.ts";

type GoingOutDisplayState = "empty" | "events" | "stale" | "unavailable";

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

function formatGoingOutDateHeading(date: string, locale: Locale) {
  const label = formatDateTime(new Date(`${date}T12:00:00.000Z`), {
    formatOptions: { dateStyle: "full", timeStyle: undefined },
    locale: getLocaleTag(locale),
  }).label;
  return label ? `${label[0].toLocaleUpperCase(getLocaleTag(locale))}${label.slice(1)}` : label;
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

export {
  formatGoingOutDateHeading,
  formatGoingOutSchedule,
  getAvailableGoingOutEvents,
  getGoingOutDisplayState,
  getGoingOutPageEvents,
  getHomepageGoingOutEvents,
  groupGoingOutEventsByDate,
  type GoingOutDateGroup,
  type GoingOutDisplayState,
};
