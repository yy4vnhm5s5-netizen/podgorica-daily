import {
  filterEventsForUi,
  getCityEventsForPublicListing,
  isHomepageEventsUnavailable,
} from "@/modules/events/presentation/events-ui-model";
import { getUpcomingPodgoricaFlightGroups } from "@/modules/flights/presentation/podgorica-flights-ui-model";
import { getGoingOutPageEvents } from "@/modules/going-out/presentation/going-out-ui-model";
import { getWeatherTemperature } from "@/modules/weather/presentation/weather-temperature";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { loadCityDashboardData } from "@/app/city-dashboard-data";
import { isCityPublicFeatureRouteAvailable } from "@/app/city-routing";
import { createCityContext, getActiveCities, getCityName } from "@/shared/config/cities";
import {
  getCityPath,
  getElectricityPath,
  getEventsPath,
  getFlightsPath,
  getGoingOutPath,
} from "@/shared/config/public-routes";
import { getPageTitle, siteConfig } from "@/shared/config/site";
import type { City, CityContext } from "@/shared/types/city";

type CityHighlightVisual = "calendar" | "cloud" | "music" | "plane";

interface CityHighlight {
  accessibilityLabel: string;
  href?: string;
  key: string;
  label: string;
  priority: number;
  state: "available" | "unavailable";
  value: string;
  visual: CityHighlightVisual;
}

interface CityModuleShortcut {
  href: string;
  key: string;
  label: string;
}

interface PlatformCityCardData {
  city: City;
  highlights: readonly CityHighlight[];
  href: string;
  shortcuts: readonly CityModuleShortcut[];
}

const platformHomepageDescription =
  "Gradom.me okuplja provjerene lokalne informacije za gradove Crne Gore — vrijeme, događaje, prevoz i servisne obavijesti na jednom mjestu.";

function getPlatformHomepageMetadata() {
  return createPublicRouteMetadata({
    canonical: "/",
    description: platformHomepageDescription,
    title: getPageTitle("Lokalne informacije za gradove Crne Gore"),
  });
}

async function getPlatformCityCards(cities: readonly City[] = getActiveCities()) {
  return Promise.all(
    cities.map((city) => getPlatformCityCardData(createCityContext(city.id, "me"))),
  );
}

async function getPlatformCityCardData(context: CityContext): Promise<PlatformCityCardData> {
  const fallback = createPlatformCityCardData(context, null);

  try {
    const dashboardData = await loadCityDashboardData(context);
    return createPlatformCityCardData(context, dashboardData);
  } catch {
    return fallback;
  }
}

function createPlatformCityCardData(
  context: CityContext,
  dashboardData: Awaited<ReturnType<typeof loadCityDashboardData>> | null,
): PlatformCityCardData {
  const { city } = context;
  const highlights: CityHighlight[] = [];

  if (city.capabilities?.includes("weather")) {
    const temperature = getWeatherTemperature(dashboardData?.weather ?? null);
    highlights.push({
      accessibilityLabel:
        temperature === undefined ? "Vrijeme nije dostupno" : `Temperatura ${temperature} stepeni`,
      key: "weather",
      label: "Vrijeme",
      priority: 1,
      state: "available",
      value: temperature === undefined ? "Nije dostupno" : `${Math.round(temperature)} °C`,
      visual: "cloud",
    });
  }

  if (isCityPublicFeatureRouteAvailable(city, "events")) {
    const events = dashboardData
      ? filterEventsForUi(getCityEventsForPublicListing(dashboardData.events.events), context, {
          datePreset: "upcoming",
          sort: "soonest",
        })
      : [];
    highlights.push(
      createCountHighlight({
        available:
          dashboardData !== null &&
          isCityEventsSummaryAvailable(dashboardData.events, events.length),
        city,
        href: getEventsPath(city),
        key: "events",
        label: "Događaji",
        priority: 2,
        value: formatCount(events.length, "događaj", "događaja"),
        visual: "calendar",
      }),
    );
  }

  if (isCityPublicFeatureRouteAvailable(city, "goingOut")) {
    const events = dashboardData?.goingOut
      ? getGoingOutPageEvents(dashboardData.goingOut.events)
      : [];
    highlights.push(
      createCountHighlight({
        available:
          dashboardData !== null &&
          isSnapshotSummaryAvailable(dashboardData.goingOut?.state, events.length),
        city,
        href: getGoingOutPath(city),
        key: "going-out",
        label: "Izlasci",
        priority: 3,
        value: formatCount(events.length, "izlazak", "izlaska", "izlazaka"),
        visual: "music",
      }),
    );
  }

  if (isCityPublicFeatureRouteAvailable(city, "flights")) {
    const groups = dashboardData?.flights
      ? getUpcomingPodgoricaFlightGroups(dashboardData.flights.flights, new Date(), 5)
      : { arrival: [], departure: [] };
    const count = groups.arrival.length + groups.departure.length;
    highlights.push(
      createCountHighlight({
        available:
          dashboardData !== null && isSnapshotSummaryAvailable(dashboardData.flights?.state, count),
        city,
        href: getFlightsPath(city),
        key: "flights",
        label: "Letovi",
        priority: 4,
        value: formatCount(count, "let", "leta", "letova"),
        visual: "plane",
      }),
    );
  }

  return {
    city,
    highlights: highlights.sort((left, right) => left.priority - right.priority).slice(0, 6),
    href: getCityPath(city),
    shortcuts: getCityModuleShortcuts(city),
  };
}

function isCityEventsSummaryAvailable(
  events: Awaited<ReturnType<typeof loadCityDashboardData>>["events"],
  count: number,
) {
  const providers = events.providers.filter((provider) => provider.id !== "cineplexx-podgorica");

  if (isHomepageEventsUnavailable(providers)) return false;
  if (count > 0) return true;

  return providers.some((provider) => provider.state === "fresh");
}

function isSnapshotSummaryAvailable(
  state: "fresh" | "stale" | "unavailable" | undefined,
  count: number,
) {
  return state === "fresh" || (state === "stale" && count > 0);
}

function createCountHighlight({
  available,
  city,
  href,
  key,
  label,
  priority,
  value,
  visual,
}: {
  available: boolean;
  city: City;
  href: string;
  key: string;
  label: string;
  priority: number;
  value: string;
  visual: CityHighlightVisual;
}): CityHighlight {
  return {
    accessibilityLabel: available ? `${value} u ${city.name}` : `${label}: podaci nijesu dostupni`,
    href,
    key,
    label,
    priority,
    state: available ? "available" : "unavailable",
    value: available ? value : "Podaci nijesu dostupni",
    visual,
  };
}

function getCityModuleShortcuts(city: City): CityModuleShortcut[] {
  const definitions: Array<
    CityModuleShortcut & { capability: "electricity" | "events" | "flights" | "goingOut" }
  > = [
    { capability: "events", href: getEventsPath(city), key: "events", label: "Događaji" },
    { capability: "goingOut", href: getGoingOutPath(city), key: "going-out", label: "Izlasci" },
    { capability: "flights", href: getFlightsPath(city), key: "flights", label: "Letovi" },
    {
      capability: "electricity",
      href: getElectricityPath(city),
      key: "electricity",
      label: "Struja",
    },
  ];

  return definitions.filter((shortcut) =>
    isCityPublicFeatureRouteAvailable(city, shortcut.capability),
  );
}

function createPlatformHomepageStructuredData(cards: readonly PlatformCityCardData[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        description: platformHomepageDescription,
        name: siteConfig.name,
        url: siteConfig.url,
      },
      {
        "@type": "ItemList",
        itemListElement: cards.map((card, index) => ({
          "@type": "ListItem",
          name: card.city.name,
          position: index + 1,
          url: new URL(card.href, siteConfig.url).toString(),
        })),
        name: "Podržani gradovi na Gradom.me",
      },
    ],
  };
}

function formatCityNames(cards: readonly PlatformCityCardData[]) {
  const cityNames = cards.map((card) => getCityName(card.city, "accusative"));
  if (cityNames.length < 2) return cityNames[0] ?? "";
  if (cityNames.length === 2) return `${cityNames[0]} i ${cityNames[1]}`;
  return `${cityNames.slice(0, -1).join(", ")} i ${cityNames.at(-1)}`;
}

function formatCount(count: number, singular: string, paucal: string, plural = paucal) {
  const lastTwo = count % 100;
  const last = count % 10;
  const form =
    lastTwo >= 11 && lastTwo <= 14
      ? plural
      : last === 1
        ? singular
        : last >= 2 && last <= 4
          ? paucal
          : plural;
  return `${count} ${form}`;
}

export {
  createPlatformCityCardData,
  createPlatformHomepageStructuredData,
  formatCount,
  formatCityNames,
  getPlatformCityCards,
  getPlatformHomepageMetadata,
  platformHomepageDescription,
  type CityHighlight,
  type CityHighlightVisual,
  type CityModuleShortcut,
  type PlatformCityCardData,
};
