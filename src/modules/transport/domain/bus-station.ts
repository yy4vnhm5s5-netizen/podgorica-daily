import type { City, CityId } from "@/shared/types/city";

type BusStationProvider = "busticket4me";

interface BusStationConfig {
  cityName: string;
  citySlug: string;
  provider: BusStationProvider;
  stationId: string;
  stationUrl: string;
  timezone: string;
}

interface BusStationDepartureCandidate {
  departureAt: string;
  destination: string;
  platform?: string;
  carrier?: string;
  bookingUrl?: string;
}

interface BusStationDeparture {
  departureAt: string;
  destination: string;
  platform?: string;
  carrier?: string;
  bookingUrl?: string;
}

const busStations: Partial<Record<CityId, BusStationConfig>> = {
  podgorica: {
    cityName: "Podgorica",
    citySlug: "podgorica",
    provider: "busticket4me",
    stationId: "1121",
    stationUrl: "https://busticket4.me/mne/bus-station/details/podgorica?station_id=1121",
    timezone: "Europe/Podgorica",
  },
};

const offsetDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function getBusStationConfig(city: City) {
  return busStations[city.id];
}

function normalizeBusStationDeparture(
  candidate: BusStationDepartureCandidate,
): BusStationDeparture | undefined {
  const departureAt = new Date(candidate.departureAt);
  const destination = candidate.destination.trim();

  if (
    !offsetDateTimePattern.test(candidate.departureAt) ||
    !Number.isFinite(departureAt.getTime()) ||
    !destination
  ) {
    return undefined;
  }

  return {
    ...(candidate.bookingUrl ? { bookingUrl: candidate.bookingUrl } : {}),
    ...(candidate.carrier ? { carrier: candidate.carrier } : {}),
    departureAt: departureAt.toISOString(),
    destination,
    ...(candidate.platform ? { platform: candidate.platform } : {}),
  };
}

function selectUpcomingBusStationDepartures(
  departures: readonly BusStationDeparture[] | undefined,
  now = new Date(),
) {
  if (!departures) return [];

  return departures
    .filter(({ departureAt }) => new Date(departureAt) >= now)
    .sort(
      (left, right) => new Date(left.departureAt).getTime() - new Date(right.departureAt).getTime(),
    )
    .slice(0, 3);
}

export {
  getBusStationConfig,
  normalizeBusStationDeparture,
  selectUpcomingBusStationDepartures,
  type BusStationConfig,
  type BusStationDeparture,
  type BusStationDepartureCandidate,
  type BusStationProvider,
};
