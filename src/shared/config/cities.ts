import { defaultLocale, type Locale } from "@/shared/config/locale";
import type { City, CityContext, CityId } from "@/shared/types/city";

const cityRegistry: Record<CityId, City> = {
  bar: {
    country: "Montenegro",
    displayName: "Bar",
    enabled: false,
    id: "bar",
    latitude: 42.0937,
    longitude: 19.1005,
    slug: "bar",
    timezone: "Europe/Podgorica",
  },
  niksic: {
    country: "Montenegro",
    displayName: "Nikšić",
    enabled: false,
    id: "niksic",
    latitude: 42.7731,
    longitude: 18.9445,
    slug: "niksic",
    timezone: "Europe/Podgorica",
  },
  podgorica: {
    country: "Montenegro",
    displayName: "Podgorica",
    enabled: true,
    id: "podgorica",
    latitude: 42.441,
    longitude: 19.263,
    slug: "podgorica",
    timezone: "Europe/Podgorica",
  },
};

function isCityId(value: string): value is CityId {
  return value in cityRegistry;
}

function getCity(cityId: CityId) {
  return cityRegistry[cityId];
}

function createCityContext(cityId: CityId, locale: Locale = defaultLocale): CityContext {
  const city = getCity(cityId);
  return { city, locale, timezone: city.timezone };
}

export { cityRegistry, createCityContext, getCity, isCityId };
