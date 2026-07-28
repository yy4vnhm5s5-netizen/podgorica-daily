import {
  getActiveCityContextBySlug,
  getActiveCityContextForCapability,
  getMainCityContext,
  supportsCityAlerts,
} from "@/config/city-context";
import { cineplexxEventProviderMetadata } from "@/modules/events/infrastructure/cineplexx-event-provider";
import {
  getActiveCities,
  getCityName,
  isActiveCity,
  isCitySupportedByProvider,
  supportsCityCapability,
} from "@/shared/config/cities";
import {
  getCityPath,
  getCinemaPath,
  getElectricityPath,
  getEventsPath,
  getFlightsPath,
  getGoingOutPath,
  getSeaWaterQualityPath,
} from "@/shared/config/public-routes";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { isFeatureEnabled, type Feature } from "@/shared/config/features";
import { getPageTitle } from "@/shared/config/site";
import type { City, CityCapability, CityContext } from "@/shared/types/city";

interface CityRouteAvailabilityOptions {
  isFeatureEnabled?: typeof isFeatureEnabled;
}

interface CityDashboardSummaryAvailability {
  cinema: boolean;
  events: boolean;
  goingOut: boolean;
  seaWaterQuality: boolean;
}

const publicFeatureByCityCapability: Partial<Record<CityCapability, Feature>> = {
  flights: "flights",
  goingOut: "goingOut",
  seaWaterQuality: "seaWaterQuality",
};

function getCityLandingTitle(context: CityContext) {
  if (!supportsCityCapability(context.city, "events")) {
    return getPageTitle(`${getCityName(context.city)} — lokalne informacije`);
  }

  const labels = [
    "događaji",
    ...(supportsCityCapability(context.city, "goingOut") ? ["izlasci"] : []),
  ];

  return getPageTitle(
    labels.length > 0
      ? `${getCityName(context.city)} — ${labels.join(", ")} i informacije`
      : `${getCityName(context.city)} — lokalne informacije`,
  );
}

function getCityLandingMetadata(context: CityContext) {
  const canonical = getCityPath(context.city);
  const availableServices = [
    ...(supportsCityCapability(context.city, "weather") ? ["vremenu"] : []),
    ...(supportsCityCapability(context.city, "events") ? ["događajima"] : []),
    ...(supportsCityCapability(context.city, "goingOut") ? ["izlascima"] : []),
    ...(supportsCityCapability(context.city, "electricity") ? ["servisnim obavještenjima"] : []),
  ];
  const description = availableServices.length
    ? `Pouzdane lokalne informacije za grad ${getCityName(context.city)}, sa podacima o ${availableServices.join(", ")}.`
    : `Pouzdane lokalne informacije za grad ${getCityName(context.city)}.`;

  return createPublicRouteMetadata({ canonical, description, title: getCityLandingTitle(context) });
}

function getMainCityLandingContext() {
  return getMainCityContext("me");
}

function resolveActiveCityRoute(slug: string) {
  return getActiveCityContextBySlug(slug, "me");
}

function resolveActiveCityFeatureRoute(slug: string, capability: CityCapability) {
  return getActiveCityContextForCapability(slug, capability, "me");
}

function getCanonicalCitySitemapPaths() {
  return getActiveCities().map((city) => getCityPath(city));
}

function isCityPublicFeatureRouteAvailable(
  city: City,
  capability: CityCapability,
  { isFeatureEnabled: checkFeature = isFeatureEnabled }: CityRouteAvailabilityOptions = {},
) {
  if (!isActiveCity(city) || !supportsCityCapability(city, capability)) return false;

  const feature = publicFeatureByCityCapability[capability];
  return feature ? checkFeature(feature) : true;
}

// Cinema is a Cineplexx-specific sub-feature of "events", not a synonym for it — Cineplexx only
// covers Podgorica (see cineplexxEventProviderMetadata.supportedCityIds). A city with a different
// events provider (e.g. Tivat, backed only by the Tourism Tivat provider) must not get a
// reachable /filmovi route, a sitemap entry for it, or a "Filmovi" dashboard/homepage tile that
// can only ever show "no movies" or "unavailable".
function isCityCinemaRouteAvailable(city: City, options: CityRouteAvailabilityOptions = {}) {
  return (
    isCityPublicFeatureRouteAvailable(city, "events", options) &&
    isCitySupportedByProvider(city, cineplexxEventProviderMetadata.supportedCityIds)
  );
}

function getCitySitemapPaths(city: City, options: CityRouteAvailabilityOptions = {}) {
  return [
    getCityPath(city),
    ...(isCityCinemaRouteAvailable(city, options) ? [getCinemaPath(city)] : []),
    ...(isCityPublicFeatureRouteAvailable(city, "events", options) ? [getEventsPath(city)] : []),
    ...(isCityPublicFeatureRouteAvailable(city, "electricity", options)
      ? [getElectricityPath(city)]
      : []),
    ...(isCityPublicFeatureRouteAvailable(city, "flights", options) ? [getFlightsPath(city)] : []),
    ...(isCityPublicFeatureRouteAvailable(city, "goingOut", options)
      ? [getGoingOutPath(city)]
      : []),
    ...(isCityPublicFeatureRouteAvailable(city, "seaWaterQuality", options)
      ? [getSeaWaterQualityPath(city)]
      : []),
  ];
}

function getActiveCitySitemapPaths(
  cities: readonly City[] = getActiveCities(),
  options: CityRouteAvailabilityOptions = {},
) {
  return cities.filter(isActiveCity).flatMap((city) => getCitySitemapPaths(city, options));
}

function getCityDashboardCapabilities(context: CityContext) {
  return {
    cityAlerts: supportsCityAlerts(context.city),
    events: supportsCityCapability(context.city, "events"),
    flights: supportsCityCapability(context.city, "flights"),
    goingOut: supportsCityCapability(context.city, "goingOut"),
    railway: supportsCityCapability(context.city, "railway"),
    seaWaterQuality: supportsCityCapability(context.city, "seaWaterQuality"),
    weather: supportsCityCapability(context.city, "weather"),
  };
}

function getCityDashboardSummaryAvailability(
  city: City,
  options: CityRouteAvailabilityOptions = {},
): CityDashboardSummaryAvailability {
  const events = isCityPublicFeatureRouteAvailable(city, "events", options);

  return {
    cinema: isCityCinemaRouteAvailable(city, options),
    events,
    goingOut: isCityPublicFeatureRouteAvailable(city, "goingOut", options),
    seaWaterQuality: isCityPublicFeatureRouteAvailable(city, "seaWaterQuality", options),
  };
}

export {
  getCanonicalCitySitemapPaths,
  getActiveCitySitemapPaths,
  getCityDashboardCapabilities,
  getCityDashboardSummaryAvailability,
  getCityLandingMetadata,
  getCityLandingTitle,
  isCityCinemaRouteAvailable,
  isCityPublicFeatureRouteAvailable,
  getCitySitemapPaths,
  getMainCityLandingContext,
  resolveActiveCityFeatureRoute,
  resolveActiveCityRoute,
  type CityDashboardSummaryAvailability,
};
