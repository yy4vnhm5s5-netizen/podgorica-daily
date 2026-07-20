import type { Locale } from "@/shared/config/locale";

function getContactPath(locale: Locale) {
  return locale === "me" ? "/me/kontakt" : "/en/contact";
}

function getContactLocaleAlternates() {
  return {
    en: getContactPath("en"),
    "sr-Latn-ME": getContactPath("me"),
    "x-default": getContactPath("me"),
  };
}

export { getContactLocaleAlternates, getContactPath };
