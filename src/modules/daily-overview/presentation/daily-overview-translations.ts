import type { Locale } from "@/shared/config/locale";

interface DailyOverviewTranslations {
  airQualityCategories: Record<"good" | "moderate" | "unhealthy", string>;
  airQualityLabel: string;
  eventsLabel: string;
  lastUpdated: string;
  loading: string;
  summaryLabel: string;
  temperature: string;
  noEvents: string;
  unavailable: string;
}

const dailyOverviewTranslations: Record<Locale, DailyOverviewTranslations> = {
  en: {
    airQualityCategories: { good: "Good", moderate: "Moderate", unhealthy: "Poor" },
    airQualityLabel: "Air quality",
    eventsLabel: "Events today",
    lastUpdated: "Updated",
    loading: "Loading daily information",
    summaryLabel: "Daily summary",
    temperature: "Temperature",
    noEvents: "No events",
    unavailable: "Data is currently unavailable.",
  },
  me: {
    airQualityCategories: { good: "Dobar", moderate: "Umjeren", unhealthy: "Loš" },
    airQualityLabel: "Kvalitet vazduha",
    eventsLabel: "Događaji danas",
    lastUpdated: "Ažurirano",
    loading: "Učitavanje dnevnih informacija",
    summaryLabel: "Dnevni sažetak",
    temperature: "Temperatura",
    noEvents: "Bez događaja",
    unavailable: "Podaci trenutno nijesu dostupni.",
  },
};

function getDailyOverviewTranslations(locale: Locale) {
  return dailyOverviewTranslations[locale];
}

export { getDailyOverviewTranslations, type DailyOverviewTranslations };
