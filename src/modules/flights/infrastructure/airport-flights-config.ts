import type { CityId } from "@/shared/types/city";

const montenegroAirportsFeedUrl = "https://montenegroairports.com/aerodromixs/cache-flights.php";

type AirportFlightsParserKind = "podgorica" | "tivat";

interface AirportFlightsSource {
  cityId: CityId;
  displayName: string;
  feedSelector: string;
  officialPageUrl: string;
  parserKind: AirportFlightsParserKind;
}

const airportFlightsSources = {
  podgorica: {
    cityId: "podgorica",
    displayName: "Aerodrom Podgorica",
    feedSelector: "pg",
    officialPageUrl: "https://montenegroairports.com/aerodrom-podgorica/",
    parserKind: "podgorica",
  },
  tivat: {
    cityId: "tivat",
    displayName: "Aerodrom Tivat",
    feedSelector: "tv",
    officialPageUrl: "https://montenegroairports.com/aerodrom-tivat/",
    parserKind: "tivat",
  },
} as const satisfies Record<string, AirportFlightsSource>;

type FlightsSupportedCityId = keyof typeof airportFlightsSources;

function isFlightsSupportedCityId(cityId: string): cityId is FlightsSupportedCityId {
  return Object.hasOwn(airportFlightsSources, cityId);
}

function getAirportFlightsSource(cityId: FlightsSupportedCityId) {
  return airportFlightsSources[cityId];
}

function getAirportFlightsSourceForCity(cityId: string) {
  return isFlightsSupportedCityId(cityId) ? getAirportFlightsSource(cityId) : undefined;
}

function createAirportFlightsUrl(cityId: FlightsSupportedCityId) {
  return `${montenegroAirportsFeedUrl}?airport=${getAirportFlightsSource(cityId).feedSelector}`;
}

function getAirportFlightsSourceBySelector(selector: string) {
  return Object.values(airportFlightsSources).find((source) => source.feedSelector === selector);
}

export {
  airportFlightsSources,
  createAirportFlightsUrl,
  getAirportFlightsSource,
  getAirportFlightsSourceForCity,
  getAirportFlightsSourceBySelector,
  isFlightsSupportedCityId,
  montenegroAirportsFeedUrl,
  type AirportFlightsParserKind,
  type AirportFlightsSource,
  type FlightsSupportedCityId,
};
