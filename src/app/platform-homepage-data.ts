import type { EventProviderState } from "@/modules/events/domain/event";
import { selectMoviesWithUpcomingScreenings } from "@/modules/events/presentation/cineplexx-programme-ui-model";
import {
  filterEventsForUi,
  getCityEventsForPublicListing,
  isHomepageEventsUnavailable,
} from "@/modules/events/presentation/events-ui-model";
import { getGoingOutPageEvents } from "@/modules/going-out/presentation/going-out-ui-model";
import { getWeatherTemperature } from "@/modules/weather/presentation/weather-temperature";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { loadCityDashboardData } from "@/app/city-dashboard-data";
import { isCityCinemaRouteAvailable, isCityPublicFeatureRouteAvailable } from "@/app/city-routing";
import { createCityContext, getActiveCities, getCityName } from "@/shared/config/cities";
import { formatBcsCount, formatCountLabel } from "@/shared/lib/pluralize";
import {
  getCityPath,
  getElectricityPath,
  getEventsPath,
  getFlightsPath,
  getGoingOutPath,
  getSeaWaterQualityPath,
} from "@/shared/config/public-routes";
import { getPageTitle, siteConfig } from "@/shared/config/site";
import type { City, CityContext } from "@/shared/types/city";

type CityHighlightVisual = "calendar" | "cloud" | "film" | "music" | "waves";

interface CityHighlight {
  accessibilityLabel: string;
  href?: string;
  key: string;
  /** Omit for a metric whose icon + value are already self-explanatory (e.g. weather: a
   * thermometer icon next to "34°C" doesn't need a "temperatura" caption underneath). */
  label?: string;
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

// Platform city cards do not render transport metrics. Avoid opening those two
// city snapshots for every active city while preserving the full city dashboard
// loader defaults for routes that do render them.
const platformCityCardDataLoadOptions = {
  includeFlights: false,
  includeRailway: false,
};

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
    const dashboardData = await loadCityDashboardData(
      context,
      undefined,
      platformCityCardDataLoadOptions,
    );
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
        label: formatCountLabel(events.length, {
          few: "događaja",
          many: "događaja",
          one: "događaj",
        }),
        priority: 2,
        value: String(events.length),
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
        label: formatCountLabel(events.length, {
          few: "izlaska",
          many: "izlazaka",
          one: "izlazak",
        }),
        priority: 3,
        value: String(events.length),
        visual: "music",
      }),
    );
  }

  if (isCityPublicFeatureRouteAvailable(city, "seaWaterQuality")) {
    const totalLocations = dashboardData?.seaWaterQuality?.summary?.totalLocations ?? 0;
    highlights.push(
      createCountHighlight({
        available:
          dashboardData !== null &&
          isSnapshotSummaryAvailable(dashboardData.seaWaterQuality?.state, totalLocations),
        city,
        href: getSeaWaterQualityPath(city),
        key: "sea-water-quality",
        label: formatCountLabel(totalLocations, {
          few: "kupališta",
          many: "kupališta",
          one: "kupalište",
        }),
        priority: 5,
        value: String(totalLocations),
        visual: "waves",
      }),
    );
  }

  // isCityCinemaRouteAvailable (not the generic "events" capability): Cineplexx is a Podgorica-only
  // sub-feature, so other events-capable cities (e.g. Tivat, backed only by the Tourism Tivat
  // provider) must not show a permanently-unavailable "Filmovi" tile.
  if (isCityCinemaRouteAvailable(city)) {
    const cinemaEvents = dashboardData
      ? dashboardData.events.events.filter((event) => event.sourceId === "cineplexx-podgorica")
      : [];
    // Same canonical selector as the /filmovi page and the city dashboard's own movie count —
    // unique movies with a remaining screening, not a raw count of every cached Cineplexx record
    // (which could include past screenings still sitting in the cache before the next refresh).
    const count = selectMoviesWithUpcomingScreenings(cinemaEvents, { now: new Date() }).length;
    const cinemaProviderState = dashboardData?.events.providers.find(
      (provider) => provider.id === "cineplexx-podgorica",
    )?.state;
    highlights.push(
      createCountHighlight({
        available: dashboardData !== null && isSnapshotSummaryAvailable(cinemaProviderState, count),
        city,
        href: getEventsPath(city),
        key: "movies",
        label: formatCountLabel(count, { few: "filma", many: "filmova", one: "film" }),
        priority: 4,
        value: String(count),
        visual: "film",
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

function isSnapshotSummaryAvailable(state: EventProviderState | undefined, count: number) {
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
    // `value` and `label` are the split "34 / temperatura" (or "3 / događaja") pair rendered as
    // two separate elements — reconstruct the natural "3 događaja" phrase here for screen readers.
    accessibilityLabel: available
      ? `${value} ${label} u ${city.name}`
      : `${label}: podaci nijesu dostupni`,
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
    CityModuleShortcut & {
      capability: "electricity" | "events" | "flights" | "goingOut" | "seaWaterQuality";
    }
  > = [
    { capability: "events", href: getEventsPath(city), key: "events", label: "Događaji" },
    { capability: "goingOut", href: getGoingOutPath(city), key: "going-out", label: "Izlasci" },
    { capability: "flights", href: getFlightsPath(city), key: "flights", label: "Letovi" },
    {
      capability: "seaWaterQuality",
      href: getSeaWaterQualityPath(city),
      key: "sea-water-quality",
      label: "Plaže",
    },
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
  return formatBcsCount(count, singular, paucal, plural);
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
