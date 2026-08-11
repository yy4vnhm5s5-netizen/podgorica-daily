import { getCityName, isActiveCity } from "./cities.ts";
import {
  isCityPublicFeatureRouteAvailable,
  type CityRouteAvailabilityOptions,
} from "./city-routes.ts";
import {
  getCityPath,
  getElectricityPath,
  getEventsPath,
  getFlightsPath,
  getGoingOutPath,
  getParkingPath,
  getSeaWaterQualityPath,
} from "./public-routes.ts";
import type { City, CityCapability } from "@/shared/types/city";

type ExploreCityLinkKey =
  "city" | "electricity" | "events" | "flights" | "goingOut" | "parking" | "seaWaterQuality";

interface ExploreCityLink {
  href: string;
  key: ExploreCityLinkKey;
  label: string;
}

interface ExploreCityLinksOptions extends CityRouteAvailabilityOptions {
  /** Destinations to leave out — normally the feature the current page already is, so a page
   * never offers a link back to itself. */
  exclude?: readonly ExploreCityLinkKey[];
  limit?: number;
}

// Three keeps the block a contextual nudge rather than a second navigation menu.
const defaultExploreCityLinkLimit = 3;

interface ExploreCityLinkDefinition {
  /** Omitted for the city hub, which is reachable for every active city. */
  capability?: CityCapability;
  createHref: (city: City) => string;
  createLabel: (city: City) => string;
  key: ExploreCityLinkKey;
}

// Ordered by editorial value, highest first: recurring destination content (events, nightlife,
// beaches) outranks utility lookups (power, flights), and the city hub sits last so it only ever
// fills a remaining slot. Cities with few capabilities therefore still get a useful block instead
// of an empty one. Cinema is deliberately absent: it is a Cineplexx-only sub-feature of events
// whose availability check lives in the app layer, and Podgorica — the only city with it — already
// has richer destinations to fill three slots.
const exploreCityLinkDefinitions: readonly ExploreCityLinkDefinition[] = [
  {
    capability: "events",
    createHref: getEventsPath,
    createLabel: (city) => `Događaji u ${getCityName(city, "locative")}`,
    key: "events",
  },
  {
    capability: "goingOut",
    createHref: getGoingOutPath,
    createLabel: (city) => `Izlasci u ${getCityName(city, "locative")}`,
    key: "goingOut",
  },
  {
    capability: "seaWaterQuality",
    createHref: getSeaWaterQualityPath,
    createLabel: (city) => `Plaže u ${getCityName(city, "locative")}`,
    key: "seaWaterQuality",
  },
  {
    capability: "electricity",
    createHref: getElectricityPath,
    createLabel: (city) => `Struja u ${getCityName(city, "locative")}`,
    key: "electricity",
  },
  {
    capability: "flights",
    createHref: getFlightsPath,
    createLabel: (city) => `Letovi u ${getCityName(city, "locative")}`,
    key: "flights",
  },
  {
    capability: "parking",
    createHref: getParkingPath,
    createLabel: (city) => `Parking u ${getCityName(city, "locative")}`,
    key: "parking",
  },
  {
    createHref: getCityPath,
    createLabel: (city) => `Sve informacije za ${getCityName(city, "accusative")}`,
    key: "city",
  },
];

// Contextual same-city navigation: given the city a page belongs to, derive the highest-value
// other destinations within that same city. Capability-driven throughout, so a city can never be
// offered a route it does not support, and no caller needs to know which cities have what.
function getExploreCityLinks(city: City, options: ExploreCityLinksOptions = {}): ExploreCityLink[] {
  const { exclude = [], limit = defaultExploreCityLinkLimit, ...availability } = options;
  if (!isActiveCity(city)) return [];

  return exploreCityLinkDefinitions
    .filter(({ key }) => !exclude.includes(key))
    .filter(
      ({ capability }) =>
        capability === undefined ||
        isCityPublicFeatureRouteAvailable(city, capability, availability),
    )
    .slice(0, Math.max(0, limit))
    .map(({ createHref, createLabel, key }) => ({
      href: createHref(city),
      key,
      label: createLabel(city),
    }));
}

export {
  defaultExploreCityLinkLimit,
  getExploreCityLinks,
  type ExploreCityLink,
  type ExploreCityLinkKey,
  type ExploreCityLinksOptions,
};
