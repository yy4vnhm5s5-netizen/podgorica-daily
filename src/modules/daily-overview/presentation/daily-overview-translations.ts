import type { Locale } from "@/shared/config/locale";
import { getCityName } from "@/shared/config/cities";
import { formatCountLabel } from "@/shared/lib/pluralize";
import type { City } from "@/shared/types/city";

// Each Count function returns just the correctly-declined noun for that count (e.g. "događaj" vs
// "događaja"), never the digit — the value and its label are always rendered as two separate
// elements (see daily-summary-bar.tsx and platform-city-panel.tsx), so combining them into one
// "N noun" string here would defeat that structure.
interface DailyOverviewTranslations {
  eventsCount: (count: number) => string;
  moviesCount: (count: number) => string;
  performancesCount: (count: number) => string;
  seaWaterQualityCount: (count: number) => string;
  summaryLabel: string;
}

const dailyOverviewTranslations: Record<Locale, DailyOverviewTranslations> = {
  en: {
    eventsCount: (count) => (count === 1 ? "event" : "events"),
    moviesCount: (count) => (count === 1 ? "movie" : "movies"),
    performancesCount: (count) => (count === 1 ? "performance" : "performances"),
    seaWaterQualityCount: (count) => (count === 1 ? "beach" : "beaches"),
    summaryLabel: "Today in {city}",
  },
  me: {
    eventsCount: (count) =>
      formatCountLabel(count, { few: "događaja", many: "događaja", one: "događaj" }),
    moviesCount: (count) => formatCountLabel(count, { few: "filma", many: "filmova", one: "film" }),
    performancesCount: (count) =>
      formatCountLabel(count, { few: "nastupa", many: "nastupa", one: "nastup" }),
    seaWaterQualityCount: (count) =>
      formatCountLabel(count, { few: "kupališta", many: "kupališta", one: "kupalište" }),
    summaryLabel: "Danas u {city}",
  },
};

function getDailyOverviewTranslations(locale: Locale, city?: City) {
  const translations = dailyOverviewTranslations[locale];
  if (!city) return translations;

  return {
    ...translations,
    summaryLabel: translations.summaryLabel.replace(
      "{city}",
      getCityName(city, locale === "me" ? "locative" : "nominative"),
    ),
  };
}

export { getDailyOverviewTranslations, type DailyOverviewTranslations };
