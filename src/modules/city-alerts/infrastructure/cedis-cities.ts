import type { CityContext, CityId } from "@/shared/types/city";

const cedisMunicipalities = {
  bar: {
    cityId: "bar",
    headingVariants: ["Bar"],
  },
  budva: {
    cityId: "budva",
    headingVariants: ["Budva", "Opština Budva"],
  },
  kotor: {
    cityId: "kotor",
    headingVariants: ["Kotor"],
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
  ulcinj: {
    cityId: "ulcinj",
    // Only "Ulcinj". Across 11 consecutive live planned-works articles CEDIS wrote the heading as
    // "Ulcinj" or "Ulcinj:" and never once as "Opština Ulcinj" — and the word never appeared
    // anywhere outside a heading, so no free-text or formal-variant form is assumed here. "Ulcinj"
    // is already a recognized boundary in municipalityNames, so the section terminates correctly
    // at the next municipality without any parser change.
    headingVariants: ["Ulcinj"],
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
