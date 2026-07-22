import { toZonedIso } from "../../../shared/lib/date.ts";

type FlightDirection = "arrival" | "departure";

interface Flight {
  airline?: string;
  direction: FlightDirection;
  flightNumber?: string;
  location: string;
  scheduledAt: string;
  scheduledDate: string;
  scheduledTime: string;
  status?: string;
}

interface FlightCandidate {
  airline?: string;
  direction: FlightDirection;
  flightNumber?: string;
  location: string;
  scheduledDate: string;
  scheduledTime: string;
  status?: string;
}

function normalizeFlight(candidate: FlightCandidate): Flight | undefined {
  const location = normalizeText(candidate.location);
  const scheduledDate = candidate.scheduledDate.trim();
  const scheduledTime = candidate.scheduledTime.trim();
  const scheduledAt = toZonedIso({ date: scheduledDate, time: scheduledTime });

  if (!location || !scheduledAt) return undefined;

  return {
    ...(normalizeOptionalText(candidate.airline)
      ? { airline: normalizeOptionalText(candidate.airline) }
      : {}),
    direction: candidate.direction,
    ...(normalizeOptionalText(candidate.flightNumber)
      ? { flightNumber: normalizeOptionalText(candidate.flightNumber) }
      : {}),
    location,
    scheduledAt,
    scheduledDate,
    scheduledTime,
    ...(normalizeOptionalText(candidate.status)
      ? { status: normalizeOptionalText(candidate.status) }
      : {}),
  };
}

function selectUpcomingFlights(flights: readonly Flight[], now = new Date(), limit = 3) {
  return sortAndDeduplicateFlights(flights)
    .filter((flight) => new Date(flight.scheduledAt).getTime() >= now.getTime())
    .slice(0, limit);
}

function sortAndDeduplicateFlights(flights: readonly Flight[]) {
  return [
    ...new Map(
      flights
        .slice()
        .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
        .map((flight) => [flightIdentity(flight), flight]),
    ).values(),
  ];
}

function flightIdentity(flight: Flight) {
  return [
    flight.direction,
    flight.scheduledAt,
    flight.location.toLocaleLowerCase("sr-Latn-ME"),
    flight.flightNumber ?? "",
  ].join("|");
}

function normalizeOptionalText(value: string | undefined) {
  return value ? normalizeText(value) || undefined : undefined;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export {
  normalizeFlight,
  selectUpcomingFlights,
  sortAndDeduplicateFlights,
  type Flight,
  type FlightCandidate,
  type FlightDirection,
};
