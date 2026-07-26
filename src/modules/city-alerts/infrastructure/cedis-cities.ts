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
