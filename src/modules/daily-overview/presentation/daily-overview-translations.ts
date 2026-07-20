import type { Locale } from "@/shared/config/locale";

interface DailyOverviewTranslations {
  airQualityCategories: Record<"good" | "moderate" | "unhealthy", string>;
  airQualityLabel: string;
  eventsEmpty: string;
  eventsLabel: string;
  eventsToday: (count: number) => string;
  eventsUpcoming: (count: number) => string;
  lastUpdated: string;
  loading: string;
  summaryLabel: string;
  temperature: string;
  unavailable: string;
}

const dailyOverviewTranslations: Record<Locale, DailyOverviewTranslations> = {
  en: {
    airQualityCategories: { good: "Good", moderate: "Moderate", unhealthy: "Poor" },
    airQualityLabel: "Air quality",
    eventsEmpty: "No events announced.",
    eventsLabel: "Events",
    eventsToday: (count) => `${count} ${count === 1 ? "event" : "events"} today`,
    eventsUpcoming: (count) => `${count} upcoming ${count === 1 ? "event" : "events"}`,
    lastUpdated: "Updated",
    loading: "Loading daily information",
    summaryLabel: "Today in Podgorica",
    temperature: "Temperature",
    unavailable: "Data is currently unavailable.",
  },
  me: {
    airQualityCategories: { good: "Dobar", moderate: "Umjeren", unhealthy: "Loš" },
    airQualityLabel: "Kvalitet vazduha",
    eventsEmpty: "Nema najavljenih događaja.",
    eventsLabel: "Događaji",
    eventsToday: (count) => `${count} ${getMontenegrinEventNoun(count)} danas`,
    eventsUpcoming: (count) => `${count} ${getMontenegrinUpcomingAdjective(count)}`,
    lastUpdated: "Ažurirano",
    loading: "Učitavanje dnevnih informacija",
    summaryLabel: "Danas u Podgorici",
    temperature: "Temperatura",
    unavailable: "Podaci trenutno nijesu dostupni.",
  },
};

function getMontenegrinEventNoun(count: number) {
  return count % 10 === 1 && count % 100 !== 11 ? "događaj" : "događaja";
}

function getMontenegrinUpcomingAdjective(count: number) {
  const remainder = count % 10;
  const lastTwoDigits = count % 100;

  if (remainder === 1 && lastTwoDigits !== 11) return "predstojeći";
  if (remainder >= 2 && remainder <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return "predstojeća";
  }

  return "predstojećih";
}

function getDailyOverviewTranslations(locale: Locale) {
  return dailyOverviewTranslations[locale];
}

export { getDailyOverviewTranslations, type DailyOverviewTranslations };
