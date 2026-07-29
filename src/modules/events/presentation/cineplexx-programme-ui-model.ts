import { normalizeText } from "../domain/event-normalization.ts";
import type { CityEvent, EventProviderState } from "../domain/event.ts";

type CineplexxProgrammeDisplayState = "empty" | "programme" | "stale" | "unavailable";

interface CineplexxMovieGroup {
  id: string;
  imageUrl?: string;
  movieUrl?: string;
  screenings: readonly CityEvent[];
  title: string;
}

interface HomepageCinemaProgramme {
  day: "today" | "tomorrow" | "none";
  events: readonly CityEvent[];
}

function getCineplexxProgrammeDisplayState({
  eventCount,
  providerState,
}: {
  eventCount: number;
  providerState: EventProviderState | undefined;
}): CineplexxProgrammeDisplayState {
  if (eventCount > 0) return providerState === "stale" ? "stale" : "programme";
  return providerState === "unavailable" ? "unavailable" : "empty";
}

function groupCineplexxProgramme(events: readonly CityEvent[]): readonly CineplexxMovieGroup[] {
  const groups = new Map<string, CineplexxMovieGroup>();

  for (const event of events) {
    // Prefer the stable per-movie tag over the title: the Cineplexx parser reuses the same
    // movie-detail-page URL for every screening of one movie (parsed once per movie block), so
    // it is a more reliable identity than title text and matches what
    // selectMoviesWithUpcomingScreenings counts as "one movie." Not keyed by day, so the same
    // movie playing across several days is one group with every screening, not a separate group
    // per day.
    const key = tagValue(event, "movie") ?? normalizeText(event.title);
    const existing = groups.get(key);
    if (existing) {
      groups.set(key, {
        ...existing,
        imageUrl: existing.imageUrl ?? event.imageUrl,
        movieUrl: existing.movieUrl ?? tagValue(event, "movie"),
        screenings: [...existing.screenings, event],
      });
      continue;
    }

    groups.set(key, {
      id: `cineplexx-${key}`,
      imageUrl: event.imageUrl,
      movieUrl: tagValue(event, "movie"),
      screenings: [event],
      title: event.title,
    });
  }

  return [...groups.values()];
}

// A screening is "upcoming" only while startsAt is still in the future (>=, inclusive of the
// instant that equals `now`); once a screening starts it drops out here even if the film is still
// playing in the hall — a viewer opening the site cannot act on a screening that already started.
// Deliberately not using `endsAt`/duration or a grace period: Cineplexx never sets `endsAt`, and
// `status` is computed once at collection time (twice daily), so it cannot be trusted to reflect
// "in progress" at request time — only the confirmed "cancelled"/"postponed" overrides are safe to
// read from it.
function selectUpcomingCineplexxScreenings(
  events: readonly CityEvent[],
  { now }: { now: Date },
): readonly CityEvent[] {
  return events
    .filter(
      (event) =>
        (event.status === "scheduled" || event.status === "active") &&
        event.startsAt &&
        new Date(event.startsAt) >= now,
    )
    .toSorted(
      (left, right) =>
        new Date(left.startsAt ?? 0).getTime() - new Date(right.startsAt ?? 0).getTime(),
    );
}

// The canonical "unique movies with an upcoming screening" set: every distinct movie that has at
// least one screening with startsAt >= now, across every day the cached programme covers (not
// just today/tomorrow) — a screening that has already started (even if still playing) does not
// keep its movie in this set unless that same movie also has a later screening. Filtering happens
// before grouping, so a movie with one past and one future screening is counted once, and a movie
// whose every screening has already started is dropped entirely. The homepage movie count and the
// /filmovi listing page both derive their count/list from this same function so they cannot
// disagree; only the homepage's compact teaser additionally slices its *display* down to a few
// titles, via CineplexxProgrammeCard's own `limit` prop.
function selectMoviesWithUpcomingScreenings(
  events: readonly CityEvent[],
  { now }: { now: Date },
): readonly CineplexxMovieGroup[] {
  return groupCineplexxProgramme(selectUpcomingCineplexxScreenings(events, { now }));
}

function selectHomepageCinemaProgramme(
  events: readonly CityEvent[],
  { now, timeZone }: { now: Date; timeZone: string },
): HomepageCinemaProgramme {
  const today = getLocalDate(now, timeZone);
  const tomorrow = addCalendarDays(today, 1);
  const upcoming = selectUpcomingCineplexxScreenings(events, { now });
  const remainingToday = upcoming.filter((event) => getEventCalendarDay(event, timeZone) === today);

  if (remainingToday.length > 0) return { day: "today", events: remainingToday.slice(0, 3) };

  const tomorrowScreenings = upcoming.filter(
    (event) => getEventCalendarDay(event, timeZone) === tomorrow,
  );
  return tomorrowScreenings.length > 0
    ? { day: "tomorrow", events: tomorrowScreenings.slice(0, 3) }
    : { day: "none", events: [] };
}

function getEventCalendarDay(event: CityEvent, timeZone: string) {
  if (event.startDate) return event.startDate;
  if (!event.startsAt) return "date-unknown";
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(new Date(event.startsAt));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
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

function addCalendarDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function tagValue(event: CityEvent, name: string) {
  return event.tags.find((tag) => tag.startsWith(`${name}:`))?.slice(name.length + 1);
}

export {
  getCineplexxProgrammeDisplayState,
  groupCineplexxProgramme,
  selectHomepageCinemaProgramme,
  selectMoviesWithUpcomingScreenings,
  selectUpcomingCineplexxScreenings,
  type CineplexxMovieGroup,
  type CineplexxProgrammeDisplayState,
  type HomepageCinemaProgramme,
};
