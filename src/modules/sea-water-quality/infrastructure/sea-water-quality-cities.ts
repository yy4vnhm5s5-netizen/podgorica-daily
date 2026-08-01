import type { CityContext, CityId } from "@/shared/types/city";

// Municipality ids used by the official Morsko dobro monitoring API's "opstina" filter —
// confirmed by reading the populated <select id="opstina"> options on the public monitoring
// page (https://monitoring.morskodobro.me): 2 = Budva, 3 = Tivat, 4 = Kotor. This is a small, fixed
// government-administrative list, not something derived from user input. Only municipalities
// this app actually collects for are listed here — the live source also covers Bar, Herceg Novi,
// and Ulcinj, which are out of scope until separately approved.
const seaWaterQualityMunicipalities = {
  budva: { cityId: "budva", municipalityId: 2 },
  kotor: { cityId: "kotor", municipalityId: 4 },
  tivat: { cityId: "tivat", municipalityId: 3 },
} as const;

type SeaWaterQualitySupportedCityId = keyof typeof seaWaterQualityMunicipalities;

function getSeaWaterQualityMunicipality(cityId: CityId) {
  return Object.hasOwn(seaWaterQualityMunicipalities, cityId)
    ? seaWaterQualityMunicipalities[cityId as SeaWaterQualitySupportedCityId]
    : undefined;
}

function isSeaWaterQualitySupportedCityId(
  cityId: CityId,
): cityId is SeaWaterQualitySupportedCityId {
  return getSeaWaterQualityMunicipality(cityId) !== undefined;
}

function getSeaWaterQualityCityId(
  context: CityContext | CityId,
): SeaWaterQualitySupportedCityId | undefined {
  const cityId = typeof context === "string" ? context : context.city.id;
  return isSeaWaterQualitySupportedCityId(cityId) ? cityId : undefined;
}

export {
  getSeaWaterQualityCityId,
  getSeaWaterQualityMunicipality,
  isSeaWaterQualitySupportedCityId,
  seaWaterQualityMunicipalities,
  type SeaWaterQualitySupportedCityId,
};
