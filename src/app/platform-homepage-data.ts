import { getCityEventsForPublicListing } from "@/modules/events/presentation/events-ui-model";
import { getUpcomingPodgoricaFlightGroups } from "@/modules/flights/presentation/podgorica-flights-ui-model";
import { getAvailableGoingOutEvents } from "@/modules/going-out/presentation/going-out-ui-model";
import { getWeatherTemperature } from "@/modules/weather/presentation/weather-temperature";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { loadCityDashboardData } from "@/app/city-dashboard-data";
import { isCityPublicFeatureRouteAvailable } from "@/app/city-routing";
import { createCityContext, getActiveCities } from "@/shared/config/cities";
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
  const { city } = context;
  const fallback = createPlatformCityCardData(city, null);

  try {
    const dashboardData = await loadCityDashboardData(context);
    return createPlatformCityCardData(city, dashboardData);
  } catch {
    return fallback;
  }
}

function createPlatformCityCardData(
  city: City,
  dashboardData: Awaited<ReturnType<typeof loadCityDashboardData>> | null,
): PlatformCityCardData {
  const highlights: CityHighlight[] = [];

  if (city.capabilities?.includes("weather")) {
    const temperature = getWeatherTemperature(dashboardData?.weather ?? null);
    highlights.push({
      accessibilityLabel:
        temperature === undefined ? "Vrijeme nije dostupno" : `Temperatura ${temperature} stepeni`,
      key: "weather",
      label: "Vrijeme",
      priority: 1,
      value: temperature === undefined ? "Nije dostupno" : `${Math.round(temperature)} °C`,
      visual: "cloud",
    });
  }

  if (isCityPublicFeatureRouteAvailable(city, "events")) {
    const count = dashboardData
      ? getCityEventsForPublicListing(dashboardData.events.events).length
      : 0;
    highlights.push({
      accessibilityLabel: `${formatCount(count, "događaj", "događaja")} u ${city.name}`,
      href: getEventsPath(city),
      key: "events",
      label: "Događaji",
      priority: 2,
      value: formatCount(count, "događaj", "događaja"),
      visual: "calendar",
    });
  }

  if (isCityPublicFeatureRouteAvailable(city, "goingOut")) {
    const count = dashboardData?.goingOut
      ? getAvailableGoingOutEvents(dashboardData.goingOut.events).length
      : 0;
    highlights.push({
      accessibilityLabel: `${formatCount(count, "izlazak", "izlaska", "izlazaka")} u ${city.name}`,
      href: getGoingOutPath(city),
      key: "going-out",
      label: "Izlasci",
      priority: 3,
      value: formatCount(count, "izlazak", "izlaska", "izlazaka"),
      visual: "music",
    });
  }

  if (isCityPublicFeatureRouteAvailable(city, "flights")) {
    const groups = dashboardData?.flights
      ? getUpcomingPodgoricaFlightGroups(dashboardData.flights.flights, new Date(), 99)
      : { arrival: [], departure: [] };
    const count = groups.arrival.length + groups.departure.length;
    highlights.push({
      accessibilityLabel: `${formatCount(count, "let", "leta", "letova")} za ${city.name}`,
      href: getFlightsPath(city),
      key: "flights",
      label: "Letovi",
      priority: 4,
      value: formatCount(count, "let", "leta", "letova"),
      visual: "plane",
    });
  }

  return {
    city,
    highlights: highlights.sort((left, right) => left.priority - right.priority).slice(0, 6),
    href: getCityPath(city),
    shortcuts: getCityModuleShortcuts(city),
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
  getPlatformCityCards,
  getPlatformHomepageMetadata,
  platformHomepageDescription,
  type CityHighlight,
  type CityHighlightVisual,
  type CityModuleShortcut,
  type PlatformCityCardData,
};
