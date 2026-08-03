import { isIsoDate, isIsoTimestamp, type CityEvent } from "./event.ts";

// Where an event sits relative to a reference instant. Deliberately separate from `EventStatus`:
// `status` is computed once during normalization and frozen into the snapshot, so a snapshot
// written while an event was still upcoming keeps saying "scheduled" long after the event ended.
// Lifecycle is always derived at read time from the event's own dates plus an injected `now`.
type EventLifecycleState = "ended" | "ongoing" | "unknown" | "upcoming";

// Bounded discovery window for events that have already ended. Standard event providers refresh
// every three hours and the quality policy already drops anything more than `maximumPastDays`
// (30 by default) old, so this window only decides how long a *just*-ended event keeps being
// advertised for crawling. Two calendar days is long enough for a crawler to re-fetch the sitemap
// and re-read the page now that it says the event is over, and short enough that the sitemap never
// accumulates weeks of dead events.
const eventSitemapEndedWindowDays = 2;

interface EventLifecycleOptions {
  now: Date;
  timezone: string;
}

// Date-only events are NOT "unknown": they carry a real calendar date, just no clock time, so they
// are resolved at day precision. "unknown" is reserved for an event whose date fields do not parse
// at all — the cache read boundary already drops those, so it should not occur in practice, but a
// total function is what lets callers make a deliberate decision instead of an accidental one.
function getEventLifecycleState(
  event: Pick<CityEvent, "endsAt" | "startDate" | "startsAt">,
  { now, timezone }: EventLifecycleOptions,
): EventLifecycleState {
  const startsAt = isIsoTimestamp(event.startsAt) ? new Date(event.startsAt) : undefined;
  const endsAt = isIsoTimestamp(event.endsAt) ? new Date(event.endsAt) : undefined;
  const startLocalDate = getEventStartLocalDate(event, timezone);
  if (!startLocalDate) return "unknown";

  const todayLocalDate = toLocalDate(now, timezone);
  const hasStarted = startsAt
    ? now.getTime() >= startsAt.getTime()
    : todayLocalDate >= startLocalDate;
  if (!hasStarted) return "upcoming";

  // An explicit `endsAt` is the only end we actually know. Without one we do not invent a
  // duration: the event stays "ongoing" until its local calendar day is over, so a concert that
  // started an hour ago is never reported as finished on the strength of a guess.
  const hasEnded = endsAt ? now.getTime() > endsAt.getTime() : todayLocalDate > startLocalDate;
  return hasEnded ? "ended" : "ongoing";
}

function hasEventEnded(
  event: Pick<CityEvent, "endsAt" | "startDate" | "startsAt">,
  options: EventLifecycleOptions,
) {
  return getEventLifecycleState(event, options) === "ended";
}

// The explicit sitemap rule: advertise what we want crawled. Upcoming and ongoing events always
// qualify; an ended event qualifies only inside the bounded window above; an event we cannot date
// is never promoted, because we cannot say whether it is worth crawling.
interface EventSitemapEligibilityOptions extends EventLifecycleOptions {
  windowDays?: number;
}

function isEventSitemapEligible(
  event: Pick<CityEvent, "endsAt" | "startDate" | "startsAt">,
  { now, timezone, windowDays = eventSitemapEndedWindowDays }: EventSitemapEligibilityOptions,
) {
  const state = getEventLifecycleState(event, { now, timezone });
  if (state === "upcoming" || state === "ongoing") return true;
  if (state === "unknown") return false;

  const endLocalDate = getEventEndLocalDate(event, timezone);
  if (!endLocalDate) return false;
  return differenceInCalendarDays(toLocalDate(now, timezone), endLocalDate) <= windowDays;
}

function getEventStartLocalDate(
  event: Pick<CityEvent, "startDate" | "startsAt">,
  timezone: string,
) {
  if (isIsoTimestamp(event.startsAt)) return toLocalDate(new Date(event.startsAt), timezone);
  return isIsoDate(event.startDate) ? event.startDate : undefined;
}

function getEventEndLocalDate(
  event: Pick<CityEvent, "endsAt" | "startDate" | "startsAt">,
  timezone: string,
) {
  if (isIsoTimestamp(event.endsAt)) return toLocalDate(new Date(event.endsAt), timezone);
  return getEventStartLocalDate(event, timezone);
}

// Calendar-day arithmetic on the two local date strings, so a DST transition inside the window
// cannot shift the boundary by an hour and change the answer.
function differenceInCalendarDays(later: string, earlier: string) {
  return Math.round(
    (Date.parse(`${later}T00:00:00.000Z`) - Date.parse(`${earlier}T00:00:00.000Z`)) / 86_400_000,
  );
}

function toLocalDate(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

export {
  eventSitemapEndedWindowDays,
  getEventLifecycleState,
  hasEventEnded,
  isEventSitemapEligible,
  type EventLifecycleOptions,
  type EventLifecycleState,
  type EventSitemapEligibilityOptions,
};
