import type { CityContext, CityId } from "@/shared/types/city";

const cedisMunicipalities = {
  budva: {
    cityId: "budva",
    headingVariants: ["Budva", "Opština Budva"],
  },
  podgorica: {
    cityId: "podgorica",
    headingVariants: ["Podgorica", "Glavni grad Podgorica"],
  },
  tivat: {
    cityId: "tivat",
    // "Tivat" is a recognized municipality-heading boundary in cedis-planned-outages.ts's
    // municipalityNames list already; "Opština Tivat" follows the same formal-variant pattern
    // used for Budva (an ordinary municipality, like Tivat — unlike Podgorica's "Glavni grad"
    // capital-city designation) and has been added alongside it there too.
    headingVariants: ["Tivat", "Opština Tivat"],
  },
} as const;

type CedisSupportedCityId = keyof typeof cedisMunicipalities;

function getCedisMunicipality(cityId: CityId) {
  return Object.hasOwn(cedisMunicipalities, cityId)
    ? cedisMunicipalities[cityId as CedisSupportedCityId]
    : undefined;
}

function isCedisSupportedCityId(cityId: CityId): cityId is CedisSupportedCityId {
  return getCedisMunicipality(cityId) !== undefined;
}

function getCedisCityId(context: CityContext | CityId): CedisSupportedCityId | undefined {
  const cityId = typeof context === "string" ? context : context.city.id;
  return isCedisSupportedCityId(cityId) ? cityId : undefined;
}

export {
  cedisMunicipalities,
  getCedisCityId,
  getCedisMunicipality,
  isCedisSupportedCityId,
  type CedisSupportedCityId,
};
