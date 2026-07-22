import type { Locale } from "@/shared/config/locale";

function getContactPath(locale: Locale) {
  return locale === "me" ? "/me/kontakt" : "/en/contact";
}

function getElectricityPath() {
  return "/struja";
}

function getPrivacyPolicyPath() {
  return "/me/politika-privatnosti";
}

function getTermsOfUsePath() {
  return "/me/uslovi-koriscenja";
}

export { getContactPath, getElectricityPath, getPrivacyPolicyPath, getTermsOfUsePath };
