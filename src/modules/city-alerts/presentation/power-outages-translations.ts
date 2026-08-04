import type { Locale } from "@/shared/config/locale";
import { getCityName } from "@/shared/config/cities";
import type { City } from "@/shared/types/city";

const powerOutagesTranslations = {
  en: {
    affectedLocations: "Affected locations",
    description:
      "Current and upcoming planned power outages in {city}, based on official CEDIS service notices.",
    dateUnavailable: "Date unavailable",
    checkedAt: "Last checked",
    empty: "There are no planned power outages in {city}.",
    emptyTitle: "No announced outages",
    officialSource: "View official CEDIS notice",
    scheduledTime: "Date and time",
    source: "Source: CEDIS",
    stale: "The displayed information may be outdated.",
    status: { active: "Active", scheduled: "Scheduled" },
    summary: {
      days: { many: "over {count} days", one: "over 1 day" },
      outages: { many: "{count} planned outages", one: "{count} planned outage" },
    },
    title: "Planned power outages in {city}",
    unavailable: "Data is currently unavailable.",
  },
  me: {
    affectedLocations: "Pogođene lokacije",
    description:
      "Aktuelna i najavljena planirana isključenja struje u {city}, na osnovu zvaničnih servisnih informacija CEDIS-a.",
    dateUnavailable: "Datum nije dostupan",
    checkedAt: "Provjereno",
    empty: "Bez planiranih isključenja struje u {city}.",
    emptyTitle: "Nema najavljenih isključenja",
    officialSource: "Pogledajte zvanično obavještenje CEDIS-a",
    scheduledTime: "Datum i vrijeme",
    source: "Izvor: CEDIS",
    stale: "Prikazani podaci mogu biti zastarjeli.",
    status: { active: "Aktivno", scheduled: "Planirano" },
    summary: {
      days: { many: "tokom {count} dana", one: "tokom jednog dana" },
      outages: { many: "{count} planirana isključenja", one: "{count} planirano isključenje" },
    },
    title: "Planirana isključenja struje u {city}",
    unavailable: "Podaci trenutno nijesu dostupni.",
  },
} as const;

function getPowerOutagesTranslations(locale: Locale, city: City) {
  const cityName = getCityName(city, locale === "me" ? "locative" : "nominative");
  const translations = powerOutagesTranslations[locale];

  return {
    ...translations,
    description: translations.description.replace("{city}", cityName),
    empty: translations.empty.replace("{city}", cityName),
    title: translations.title.replace("{city}", cityName),
  };
}

export { getPowerOutagesTranslations };
