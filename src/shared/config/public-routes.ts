import type { Locale } from "@/shared/config/locale";

function getContactPath(locale: Locale) {
  return locale === "me" ? "/me/kontakt" : "/en/contact";
}

function getElectricityPath() {
  return "/struja";
}

function getFlightsPath(locale: Locale) {
  return `/${locale}/letovi`;
}

function getGoingOutPath(locale: Locale) {
  return `/${locale}/izlasci`;
}

function getPrivacyPolicyPath() {
  return "/me/politika-privatnosti";
}

function getTermsOfUsePath() {
  return "/me/uslovi-koriscenja";
}

export {
  getContactPath,
  getElectricityPath,
  getFlightsPath,
  getGoingOutPath,
  getPrivacyPolicyPath,
  getTermsOfUsePath,
};
