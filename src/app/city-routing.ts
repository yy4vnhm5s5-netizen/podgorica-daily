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
  isCityPublicFeatureRouteAvailable,
  type CityRouteAvailabilityOptions,
} from "@/shared/config/city-routes";
import {
  getCityPath,
  getCinemaPath,
  getElectricityPath,
  getEventsPath,
  getFlightsPath,
  getGoingOutPath,
  getParkingPath,
  getSeaWaterQualityPath,
} from "@/shared/config/public-routes";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getPageTitle } from "@/shared/config/site";
import type { City, CityCapability, CityContext } from "@/shared/types/city";

interface CityDashboardSummaryAvailability {
  cinema: boolean;
  events: boolean;
  goingOut: boolean;
  seaWaterQuality: boolean;
}

// The headline capabilities a city hub advertises, in reading order. Coastal cities carry their
// sea-water/beach coverage here too: it is their most distinctive content (a per-location detail
// page per monitoring point), and leaving it out made every coastal hub read as generic "lokalne
// informacije". Driven entirely by the registry — a city that does not declare the capability
// never gets the wording, so Podgorica stays beach-free without being named anywhere.
function getCityLandingTitle(context: CityContext) {
  const labels = [
    ...(supportsCityCapability(context.city, "events") ? ["događaji"] : []),
    ...(supportsCityCapability(context.city, "goingOut") ? ["izlasci"] : []),
    ...(supportsCityCapability(context.city, "seaWaterQuality") ? ["plaže"] : []),
  ];

  return getPageTitle(
    labels.length > 0
      ? `${getCityName(context.city)} — ${labels.join(", ")} i informacije`
      : `${getCityName(context.city)} — lokalne informacije`,
  );
}

function getCityLandingMetadata(context: CityContext) {
  const canonical = getCityPath(context.city);
  // Every entry is governed by "sa podacima o …", so each must be in the same locative/dative
  // form ("o vremenu", "o plažama i kvalitetu mora").
  const availableServices = [
    ...(supportsCityCapability(context.city, "weather") ? ["vremenu"] : []),
    ...(supportsCityCapability(context.city, "events") ? ["događajima"] : []),
    ...(supportsCityCapability(context.city, "goingOut") ? ["izlascima"] : []),
    ...(supportsCityCapability(context.city, "seaWaterQuality")
      ? ["plažama i kvalitetu mora"]
      : []),
    ...(supportsCityCapability(context.city, "electricity") ? ["servisnim obavještenjima"] : []),
  ];
  // "za grad" governs the accusative, and the apposition has to agree with it: production shipped
  // "za grad Podgorica" and "za grad Budva" because the nominative default was used here. The four
  // masculine names are identical in both cases, which is why only two of six looked wrong.
  const cityName = getCityName(context.city, "accusative");
  const description = availableServices.length
    ? `Pouzdane lokalne informacije za grad ${cityName}, sa podacima o ${availableServices.join(", ")}.`
    : `Pouzdane lokalne informacije za grad ${cityName}.`;

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
    ...(isCityPublicFeatureRouteAvailable(city, "parking", options) ? [getParkingPath(city)] : []),
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
