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
  return selectUpcomingGoingOutEvents(events, now, 6);
}

function getGoingOutPageEvents(events: readonly GoingOutEvent[], now = new Date()) {
  return selectUpcomingGoingOutEvents(events, now, 30);
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
  formatGoingOutSchedule,
  getGoingOutDisplayState,
  getGoingOutPageEvents,
  getHomepageGoingOutEvents,
  type GoingOutDisplayState,
};
