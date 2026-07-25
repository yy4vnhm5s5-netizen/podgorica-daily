import type { Locale } from "@/shared/config/locale";

function getNewTabNotice(locale: Locale) {
  return locale === "me" ? "(otvara se u novom tabu)" : "(opens in a new tab)";
}

export { getNewTabNotice };
