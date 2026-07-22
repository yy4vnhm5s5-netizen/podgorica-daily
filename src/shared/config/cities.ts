import { defaultLocale, type Locale } from "./locale.ts";
import type { City, CityCapability, CityContext, CityId } from "@/shared/types/city";

const cityRegistry: Record<string, City> = {
  bar: {
    capabilities: [],
    country: "Montenegro",
    id: "bar",
    isActive: false,
    isMain: false,
    latitude: 42.0937,
    longitude: 19.1005,
    name: "Bar",
    slug: "bar",
    timezone: "Europe/Podgorica",
  },
  budva: {
    capabilities: [],
    country: "Montenegro",
    id: "budva",
    isActive: false,
    isMain: false,
    latitude: 42.2864,
    longitude: 18.8401,
    name: "Budva",
    slug: "budva",
    timezone: "Europe/Podgorica",
  },
  niksic: {
    capabilities: [],
    country: "Montenegro",
    id: "niksic",
    isActive: false,
    isMain: false,
    latitude: 42.7731,
    longitude: 18.9445,
    name: "Nikšić",
    slug: "niksic",
    timezone: "Europe/Podgorica",
  },
  podgorica: {
    capabilities: ["electricity", "events", "flights", "goingOut", "railway", "water"],
    country: "Montenegro",
    id: "podgorica",
    isActive: true,
    isMain: true,
    latitude: 42.441,
    longitude: 19.263,
    name: "Podgorica",
    slug: "podgorica",
    timezone: "Europe/Podgorica",
  },
};

function validateCityRegistry(
  registry: Readonly<Record<string, City>> | readonly (readonly [string, City])[],
) {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const mainCities: City[] = [];

  const entries = Array.isArray(registry) ? registry : Object.entries(registry);
  for (const [key, city] of entries) {
    if (!city.id.trim()) throw new Error(`City registry entry "${key}" has an empty ID.`);
    if (!city.slug.trim()) throw new Error(`City registry entry "${key}" has an empty slug.`);
    if (key !== city.id) {
      throw new Error(`City registry key "${key}" must match city ID "${city.id}".`);
    }
    if (ids.has(city.id)) throw new Error(`City registry contains duplicate ID "${city.id}".`);
    if (slugs.has(city.slug))
      throw new Error(`City registry contains duplicate slug "${city.slug}".`);

    ids.add(city.id);
    slugs.add(city.slug);
    if (city.isMain) mainCities.push(city);
  }

  if (mainCities.length !== 1) {
    throw new Error("City registry must contain exactly one main city.");
  }
  if (!mainCities[0].isActive) {
    throw new Error(`Main city "${mainCities[0].id}" must be active.`);
  }
}

validateCityRegistry(cityRegistry);

function isCityId(value: string): value is CityId {
  return Object.hasOwn(cityRegistry, value);
}

function getCity(cityId: string): City | undefined {
  return isCityId(cityId) ? cityRegistry[cityId] : undefined;
}

function getCityBySlug(slug: string) {
  return Object.values(cityRegistry).find((city) => city.slug === slug);
}

function getMainCity() {
  const mainCities = Object.values(cityRegistry).filter((candidate) => candidate.isMain);
  if (mainCities.length !== 1) throw new Error("City registry must contain exactly one main city.");
  const [city] = mainCities;
  if (!city.isActive) throw new Error(`Main city "${city.id}" must be active.`);
  return city;
}

function isActiveCity(city: City) {
  return city.isActive === true;
}

function getCityName(city: City) {
  return city.name;
}

function getActiveCityBySlug(slug: string) {
  const city = getCityBySlug(slug);
  return city && isActiveCity(city) ? city : undefined;
}

function getActiveCities() {
  return Object.values(cityRegistry).filter(isActiveCity);
}

function supportsCityCapability(city: City, capability: CityCapability) {
  return city.capabilities?.includes(capability) ?? false;
}

function isCitySupportedByProvider(city: City, supportedCityIds: readonly CityId[] | undefined) {
  return supportedCityIds?.includes(city.id) ?? false;
}

function createCityContext(cityId: CityId, locale: Locale = defaultLocale): CityContext {
  const city = getCity(cityId);
  if (!city) throw new Error(`Unknown city ID: ${cityId}`);
  return { city, locale, timezone: city.timezone };
}

export {
  cityRegistry,
  createCityContext,
  getActiveCities,
  getActiveCityBySlug,
  getCity,
  getCityBySlug,
  getCityName,
  getMainCity,
  isCitySupportedByProvider,
  isActiveCity,
  isCityId,
  supportsCityCapability,
  validateCityRegistry,
};
