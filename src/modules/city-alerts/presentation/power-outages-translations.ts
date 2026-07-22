import type { Locale } from "@/shared/config/locale";

const powerOutagesTranslations = {
  en: {
    affectedLocations: "Affected locations",
    description:
      "Current and upcoming planned power outages in Podgorica, based on official CEDIS service notices.",
    dateUnavailable: "Date unavailable",
    empty: "There are no planned power outages in Podgorica.",
    officialSource: "View official CEDIS notice",
    publicationTime: "Published",
    scheduledTime: "Date and time",
    source: "Source: CEDIS",
    stale: "The displayed information may be outdated.",
    status: { active: "Active", scheduled: "Scheduled" },
    summary: {
      days: { many: "over {count} days", one: "over 1 day" },
      outages: { many: "{count} planned outages", one: "{count} planned outage" },
    },
    title: "Planned power outages in Podgorica",
    unavailable: "Data is currently unavailable.",
  },
  me: {
    affectedLocations: "Pogođene lokacije",
    description:
      "Aktuelna i najavljena planirana isključenja struje u Podgorici, na osnovu zvaničnih servisnih informacija CEDIS-a.",
    dateUnavailable: "Datum nije dostupan",
    empty: "Bez planiranih isključenja struje u Podgorici.",
    officialSource: "Pogledajte zvanično obavještenje CEDIS-a",
    publicationTime: "Objavljeno",
    scheduledTime: "Datum i vrijeme",
    source: "Izvor: CEDIS",
    stale: "Prikazani podaci mogu biti zastarjeli.",
    status: { active: "Aktivno", scheduled: "Planirano" },
    summary: {
      days: { many: "tokom {count} dana", one: "tokom jednog dana" },
      outages: { many: "{count} planirana isključenja", one: "{count} planirano isključenje" },
    },
    title: "Planirana isključenja struje u Podgorici",
    unavailable: "Podaci trenutno nijesu dostupni.",
  },
} as const;

function getPowerOutagesTranslations(locale: Locale) {
  return powerOutagesTranslations[locale];
}

export { getPowerOutagesTranslations };
