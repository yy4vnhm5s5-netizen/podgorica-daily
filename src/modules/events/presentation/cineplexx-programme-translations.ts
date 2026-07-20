import type { Locale } from "@/shared/config/locale";

const cineplexxProgrammeTranslations = {
  en: {
    cta: "View full programme",
    empty: "There are no screenings at the moment.",
    stale: "The displayed programme may no longer be current.",
    subtitle: "Programme",
    title: "At the cinema",
    unavailable: "Data is currently unavailable.",
  },
  me: {
    cta: "Pogledaj kompletan repertoar",
    empty: "Trenutno nema projekcija.",
    stale: "Prikazani repertoar možda više nije aktuelan.",
    subtitle: "Repertoar",
    title: "U bioskopu",
    unavailable: "Podaci trenutno nijesu dostupni.",
  },
} as const;

function getCineplexxProgrammeTranslations(locale: Locale) {
  return cineplexxProgrammeTranslations[locale];
}

export { getCineplexxProgrammeTranslations };
