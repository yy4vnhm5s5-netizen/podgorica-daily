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
import { getPageTitle } from "@/shared/config/site";
import type { City, CityCapability, CityContext } from "@/shared/types/city";

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

function getCitySitemapPaths(city: City) {
  return [
    getCityPath(city),
    ...(supportsCityCapability(city, "events") ? [getCinemaPath(city)] : []),
    ...(supportsCityCapability(city, "events") ? [getEventsPath(city)] : []),
    ...(supportsCityCapability(city, "electricity") ? [getElectricityPath(city)] : []),
    ...(supportsCityCapability(city, "flights") ? [getFlightsPath(city)] : []),
    ...(supportsCityCapability(city, "goingOut") ? [getGoingOutPath(city)] : []),
  ];
}

function getActiveCitySitemapPaths(cities: readonly City[] = getActiveCities()) {
  return cities.filter(isActiveCity).flatMap(getCitySitemapPaths);
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
  getCitySitemapPaths,
  getMainCityLandingContext,
  resolveActiveCityFeatureRoute,
  resolveActiveCityRoute,
};
