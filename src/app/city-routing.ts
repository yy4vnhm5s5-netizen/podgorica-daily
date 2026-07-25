import {
  getActiveCityContextBySlug,
  getActiveCityContextForCapability,
  getMainCityContext,
  supportsCityAlerts,
} from "@/config/city-context";
import {
  getActiveCities,
  getCityName,
  isActiveCity,
  supportsCityCapability,
} from "@/shared/config/cities";
import {
  getCityPath,
  getCinemaPath,
  getElectricityPath,
  getEventsPath,
  getFlightsPath,
  getGoingOutPath,
} from "@/shared/config/public-routes";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { isFeatureEnabled, type Feature } from "@/shared/config/features";
import { getPageTitle } from "@/shared/config/site";
import type { City, CityCapability, CityContext } from "@/shared/types/city";

interface CityRouteAvailabilityOptions {
  isFeatureEnabled?: typeof isFeatureEnabled;
}

const publicFeatureByCityCapability: Partial<Record<CityCapability, Feature>> = {
  flights: "flights",
  goingOut: "goingOut",
};

function getCityLandingTitle(context: CityContext) {
  return getPageTitle(`${getCityName(context.city)} — događaji, izlasci i informacije`);
}

function getCityLandingMetadata(context: CityContext) {
  const canonical = getCityPath(context.city);
  const description = `Pouzdane lokalne informacije za grad ${getCityName(context.city)}.`;

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
  if (!supportsCityCapability(city, capability)) return false;

  const feature = publicFeatureByCityCapability[capability];
  return feature ? checkFeature(feature) : true;
}

function getCitySitemapPaths(city: City, options: CityRouteAvailabilityOptions = {}) {
  return [
    getCityPath(city),
    ...(isCityPublicFeatureRouteAvailable(city, "events", options) ? [getCinemaPath(city)] : []),
    ...(isCityPublicFeatureRouteAvailable(city, "events", options) ? [getEventsPath(city)] : []),
    ...(isCityPublicFeatureRouteAvailable(city, "electricity", options)
      ? [getElectricityPath(city)]
      : []),
    ...(isCityPublicFeatureRouteAvailable(city, "flights", options) ? [getFlightsPath(city)] : []),
    ...(isCityPublicFeatureRouteAvailable(city, "goingOut", options)
      ? [getGoingOutPath(city)]
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
  };
}

export {
  getCanonicalCitySitemapPaths,
  getActiveCitySitemapPaths,
  getCityDashboardCapabilities,
  getCityLandingMetadata,
  getCityLandingTitle,
  isCityPublicFeatureRouteAvailable,
  getCitySitemapPaths,
  getMainCityLandingContext,
  resolveActiveCityFeatureRoute,
  resolveActiveCityRoute,
};
