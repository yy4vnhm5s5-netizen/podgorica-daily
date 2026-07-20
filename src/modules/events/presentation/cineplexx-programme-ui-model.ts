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

function groupCineplexxProgramme(
  events: readonly CityEvent[],
  timeZone = "Europe/Podgorica",
): readonly CineplexxMovieGroup[] {
  const groups = new Map<string, CineplexxMovieGroup>();

  for (const event of events) {
    const day = getEventCalendarDay(event, timeZone);
    const key = `${normalizeText(event.title)}|${day}`;
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

function tagValue(event: CityEvent, name: string) {
  return event.tags.find((tag) => tag.startsWith(`${name}:`))?.slice(name.length + 1);
}

export {
  getCineplexxProgrammeDisplayState,
  groupCineplexxProgramme,
  type CineplexxMovieGroup,
  type CineplexxProgrammeDisplayState,
};
