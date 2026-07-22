import type { City } from "@/shared/types/city";

type CityRouteTarget = Pick<City, "slug"> | string;

function getCityPath(city: CityRouteTarget) {
  const slug = typeof city === "string" ? city : city.slug;
  return `/${encodeURIComponent(slug)}`;
}

function getContactPath() {
  return "/kontakt";
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

function getPrivacyPolicyPath() {
  return "/politika-privatnosti";
}

function getTermsOfUsePath() {
  return "/uslovi-koriscenja";
}

export {
  getCityPath,
  getCinemaPath,
  getContactPath,
  getElectricityPath,
  getEventDetailPath,
  getEventsPath,
  getFlightsPath,
  getGoingOutPath,
  getPrivacyPolicyPath,
  getTermsOfUsePath,
};
