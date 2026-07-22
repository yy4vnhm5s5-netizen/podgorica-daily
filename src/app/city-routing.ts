import type { Metadata } from "next";

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
  getElectricityPath,
  getEventsPath,
  getFlightsPath,
  getGoingOutPath,
} from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";
import type { City, CityCapability, CityContext } from "@/shared/types/city";

const openGraphDescription = "Sve što se danas dešava. Na jednom mjestu.";
const openGraphTitle = "Prošetajte svojim gradom.";

function getCityLandingTitle(context: CityContext) {
  return getPageTitle(`${getCityName(context.city)} — događaji, izlasci i informacije`);
}

function getCityLandingMetadata(context: CityContext): Metadata {
  const canonical = getCityPath(context.city);
  const description = `Pouzdane lokalne informacije za grad ${getCityName(context.city)}.`;

  return {
    alternates: { canonical },
    description,
    openGraph: {
      description: openGraphDescription,
      title: openGraphTitle,
      url: canonical,
    },
    title: { absolute: getCityLandingTitle(context) },
    twitter: { description, title: getCityLandingTitle(context) },
  };
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
  openGraphDescription,
  openGraphTitle,
  resolveActiveCityFeatureRoute,
  resolveActiveCityRoute,
};
