import type { Locale } from "@/shared/config/locale";

function getContactPath(locale: Locale) {
  return locale === "me" ? "/me/kontakt" : "/en/contact";
}

function getElectricityPath() {
  return "/struja";
}

function getContactLocaleAlternates() {
  return {
    en: getContactPath("en"),
    "sr-Latn-ME": getContactPath("me"),
    "x-default": getContactPath("me"),
  };
}

function getPrivacyPolicyPath() {
  return "/me/politika-privatnosti";
}

function getTermsOfUsePath() {
  return "/me/uslovi-koriscenja";
}

export {
  getContactLocaleAlternates,
  getContactPath,
  getElectricityPath,
  getPrivacyPolicyPath,
  getTermsOfUsePath,
};
