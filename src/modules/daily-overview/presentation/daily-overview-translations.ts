import type { Locale } from "@/shared/config/locale";

interface DailyOverviewTranslations {
  airQualityCategories: Record<"good" | "moderate" | "unhealthy", string>;
  airQualityLabel: string;
  demoNotice: string;
  emptyDescription: string;
  emptyTitle: string;
  errorDescription: string;
  errorTitle: string;
  generatedAt: string;
  loading: string;
  title: string;
}

const dailyOverviewTranslations: Record<Locale, DailyOverviewTranslations> = {
  en: {
    airQualityCategories: { good: "Good", moderate: "Moderate", unhealthy: "Poor" },
    airQualityLabel: "Air quality is currently reported as:",
    demoNotice: "This overview currently uses demo data from mock cached providers.",
    emptyDescription: "No daily overview is available right now.",
    emptyTitle: "Daily overview unavailable",
    errorDescription: "The daily overview could not be loaded. Please try again later.",
    errorTitle: "Daily overview unavailable",
    generatedAt: "Updated",
    loading: "Loading daily overview",
    title: "Today in Podgorica",
  },
  me: {
    airQualityCategories: { good: "Dobar", moderate: "Umjeren", unhealthy: "Loš" },
    airQualityLabel: "Kvalitet vazduha trenutno je označen kao:",
    demoNotice: "Ovaj pregled trenutno koristi demo podatke iz mock keširanih provajdera.",
    emptyDescription: "Dnevni pregled trenutno nije dostupan.",
    emptyTitle: "Dnevni pregled nije dostupan",
    errorDescription: "Dnevni pregled nije moguće učitati. Pokušajte ponovo kasnije.",
    errorTitle: "Dnevni pregled nije dostupan",
    generatedAt: "Ažurirano",
    loading: "Učitavanje dnevnog pregleda",
    title: "Danas u Podgorici",
  },
};

function getDailyOverviewTranslations(locale: Locale) {
  return dailyOverviewTranslations[locale];
}

export { getDailyOverviewTranslations, type DailyOverviewTranslations };
