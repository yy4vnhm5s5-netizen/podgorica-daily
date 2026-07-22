import { selectUpcomingFlights, sortAndDeduplicateFlights, type Flight } from "../domain/flight.ts";
import type { FlightCacheState } from "../infrastructure/podgorica-flights";
import type { Locale } from "../../../shared/config/locale.ts";
import { formatRelativeTime } from "../../../shared/lib/date.ts";

type PodgoricaFlightsDisplayState = "empty" | "flights" | "stale" | "unavailable";
type FlightDirectionGroup = "arrival" | "departure";

interface PodgoricaFlightGroups {
  arrival: Flight[];
  departure: Flight[];
}

function getPodgoricaFlightsDisplayState({
  flightCount,
  state,
}: {
  flightCount: number;
  state: FlightCacheState;
}): PodgoricaFlightsDisplayState {
  if (flightCount > 0) return state === "stale" ? "stale" : "flights";
  return state === "unavailable" ? "unavailable" : "empty";
}

function getPodgoricaFlightsUpdatedLabel({
  lastSuccessfulRefreshAt,
  locale,
  now = new Date(),
}: {
  lastSuccessfulRefreshAt?: string;
  locale: Locale;
  now?: Date;
}) {
  if (!lastSuccessfulRefreshAt) return undefined;

  const updatedAt = new Date(lastSuccessfulRefreshAt);
  if (Number.isNaN(updatedAt.getTime())) return undefined;

  return `${locale === "me" ? "Ažurirano" : "Updated"} ${formatRelativeTime(updatedAt, {
    locale,
    now,
  })}`;
}

function getPodgoricaFlightGroups(flights: readonly Flight[]): PodgoricaFlightGroups {
  const sortedFlights = sortAndDeduplicateFlights(flights);

  return {
    arrival: sortedFlights.filter((flight) => flight.direction === "arrival"),
    departure: sortedFlights.filter((flight) => flight.direction === "departure"),
  };
}

function getUpcomingPodgoricaFlightGroups(
  flights: readonly Flight[],
  now = new Date(),
  limit = 3,
): PodgoricaFlightGroups {
  const groups = getPodgoricaFlightGroups(flights);

  return {
    arrival: selectUpcomingFlights(groups.arrival, now, limit),
    departure: selectUpcomingFlights(groups.departure, now, limit),
  };
}

export {
  getPodgoricaFlightGroups,
  getPodgoricaFlightsDisplayState,
  getPodgoricaFlightsUpdatedLabel,
  getUpcomingPodgoricaFlightGroups,
  type FlightDirectionGroup,
  type PodgoricaFlightsDisplayState,
  type PodgoricaFlightGroups,
};
