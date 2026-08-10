import type { City } from "@/shared/types/city";

type CityRouteTarget = Pick<City, "slug"> | string;

function getCityPath(city: CityRouteTarget) {
  const slug = typeof city === "string" ? city : city.slug;
  return `/${encodeURIComponent(slug)}`;
}

function getContactPath() {
  return "/kontakt";
}

function getAboutPlatformPath() {
  return "/o-platformi";
}

function getCinemaPath(city: CityRouteTarget) {
  return `${getCityPath(city)}/filmovi`;
}

function getElectricityPath(city: CityRouteTarget) {
  return `${getCityPath(city)}/struja`;
}

function getEventsPath(city: CityRouteTarget) {
  return `${getCityPath(city)}/dogadjaji`;
}

function getEventDetailPath(city: CityRouteTarget, eventId: string) {
  return `${getEventsPath(city)}/${encodeURIComponent(eventId)}`;
}

function getFlightsPath(city: CityRouteTarget) {
  return `${getCityPath(city)}/letovi`;
}

function getGoingOutPath(city: CityRouteTarget) {
  return `${getCityPath(city)}/izlasci`;
}

function getGoingOutDetailPath(
  city: CityRouteTarget,
  provider: "montegigs",
  sourceEventId: string,
) {
  return `${getGoingOutPath(city)}/${encodeURIComponent(`${provider}-${sourceEventId}`)}`;
}

function getSeaWaterQualityPath(city: CityRouteTarget) {
  return `${getCityPath(city)}/plaze`;
}

function getSeaWaterQualityLocationPath(city: CityRouteTarget, slug: string) {
  return `${getSeaWaterQualityPath(city)}/${encodeURIComponent(slug)}`;
}

// National utility route: fuel prices are set for the whole country, so this is not city-scoped.
function getFuelPricesPath() {
  return "/gorivo";
}

function getPrivacyPolicyPath() {
  return "/politika-privatnosti";
}

function getTermsOfUsePath() {
  return "/uslovi-koriscenja";
}

export {
  getAboutPlatformPath,
  getCityPath,
  getCinemaPath,
  getContactPath,
  getFuelPricesPath,
  getElectricityPath,
  getEventDetailPath,
  getEventsPath,
  getFlightsPath,
  getGoingOutPath,
  getGoingOutDetailPath,
  getPrivacyPolicyPath,
  getSeaWaterQualityPath,
  getSeaWaterQualityLocationPath,
  getTermsOfUsePath,
};
