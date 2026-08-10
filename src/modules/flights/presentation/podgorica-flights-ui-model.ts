import { selectUpcomingFlights, sortAndDeduplicateFlights, type Flight } from "../domain/flight.ts";
import type { FlightCacheState } from "../infrastructure/podgorica-flights";
import type { Locale } from "../../../shared/config/locale.ts";
import { formatRelativeTime } from "../../../shared/lib/date.ts";

type AirportFlightsDisplayState = "empty" | "flights" | "stale" | "unavailable";
type FlightDirectionGroup = "arrival" | "departure";

interface AirportFlightGroups {
  arrival: Flight[];
  departure: Flight[];
}

function getDisplayableFlightFact(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && !/^[\-–—]+$/u.test(normalized) ? normalized : undefined;
}

function getAirportFlightsDisplayState({
  flightCount,
  state,
}: {
  flightCount: number;
  state: FlightCacheState;
}): AirportFlightsDisplayState {
  if (flightCount > 0) return state === "stale" ? "stale" : "flights";
  return state === "unavailable" ? "unavailable" : "empty";
}

function getAirportFlightsUpdatedLabel({
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

function getAirportFlightGroups(flights: readonly Flight[]): AirportFlightGroups {
  const sortedFlights = sortAndDeduplicateFlights(flights);

  return {
    arrival: sortedFlights.filter((flight) => flight.direction === "arrival"),
    departure: sortedFlights.filter((flight) => flight.direction === "departure"),
  };
}

function getUpcomingAirportFlightGroups(
  flights: readonly Flight[],
  now = new Date(),
  limit = 3,
): AirportFlightGroups {
  const groups = getAirportFlightGroups(flights);

  return {
    arrival: selectUpcomingFlights(groups.arrival, now, limit),
    departure: selectUpcomingFlights(groups.departure, now, limit),
  };
}

export {
  getDisplayableFlightFact,
  getAirportFlightGroups,
  getAirportFlightsDisplayState,
  getAirportFlightsUpdatedLabel,
  getUpcomingAirportFlightGroups,
  type FlightDirectionGroup,
  type AirportFlightsDisplayState,
  type AirportFlightGroups,
};
