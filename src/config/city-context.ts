import { env } from "@/config/env";
import {
  createCityContext,
  getActiveCityBySlug,
  getMainCity,
  isCityId,
  supportsCityCapability,
} from "@/shared/config/cities";
import { defaultLocale, type Locale } from "@/shared/config/locale";
import type { City, CityCapability, CityContext } from "@/shared/types/city";

const cityAlertCapabilities = ["electricity", "trafficAlerts", "water"] as const;

function getDefaultCityContext(locale: Locale = defaultLocale) {
  if (!isCityId(env.DEFAULT_CITY)) {
    throw new Error("DEFAULT_CITY must exist in the city registry.");
  }
  return createCityContext(env.DEFAULT_CITY, locale);
}

function getMainCityContext(locale: Locale = defaultLocale) {
  const city = getMainCity();
  return createCityContext(city.id, locale);
}

function getActiveCityContextBySlug(slug: string, locale: Locale = defaultLocale) {
  const city = getActiveCityBySlug(slug);
  return city ? createCityContext(city.id, locale) : undefined;
}

function getActiveCityContextForCapability(
  slug: string,
  capability: CityCapability,
  locale: Locale = defaultLocale,
) {
  return resolveCityContextCapability(getActiveCityContextBySlug(slug, locale), capability);
}

function resolveCityContextCapability(
  context: CityContext | undefined,
  capability: CityCapability,
) {
  return context && supportsCityCapability(context.city, capability) ? context : undefined;
}

function supportsCityAlerts(city: City) {
  return cityAlertCapabilities.some((capability) => supportsCityCapability(city, capability));
}

export {
  getActiveCityContextBySlug,
  getActiveCityContextForCapability,
  getDefaultCityContext,
  getMainCityContext,
  resolveCityContextCapability,
  supportsCityAlerts,
};
