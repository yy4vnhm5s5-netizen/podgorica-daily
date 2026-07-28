import type { Locale } from "@/shared/config/locale";
import { getCityName } from "@/shared/config/cities";
import { formatBcsCount } from "@/shared/lib/pluralize";
import type { City } from "@/shared/types/city";

interface DailyOverviewTranslations {
  eventsLabel: string;
  eventsCount: (count: number) => string;
  moviesCount: (count: number) => string;
  moviesLabel: string;
  performancesCount: (count: number) => string;
  performancesLabel: string;
  seaWaterQualityCount: (count: number) => string;
  seaWaterQualityLabel: string;
  summaryLabel: string;
  temperature: string;
}

const dailyOverviewTranslations: Record<Locale, DailyOverviewTranslations> = {
  en: {
    eventsLabel: "Events",
    eventsCount: (count) => `${count} ${count === 1 ? "Event" : "Events"}`,
    moviesCount: (count) => `${count} ${count === 1 ? "Movie" : "Movies"}`,
    moviesLabel: "Movies",
    performancesCount: (count) => `${count} ${count === 1 ? "Performance" : "Performances"}`,
    performancesLabel: "Going out",
    seaWaterQualityCount: (count) => `${count} ${count === 1 ? "beach" : "beaches"}`,
    seaWaterQualityLabel: "Beaches",
    summaryLabel: "Today in {city}",
    temperature: "Temperature",
  },
  me: {
    eventsLabel: "Događaji",
    eventsCount: (count) => `${count} ${capitalize(getMontenegrinEventNoun(count))}`,
    moviesCount: (count) => formatBcsCount(count, "Film", "Filma", "Filmova"),
    moviesLabel: "Filmovi",
    performancesCount: (count) => `${count} ${count === 1 ? "Nastup" : "Nastupa"}`,
    performancesLabel: "Nastupi",
    seaWaterQualityCount: (count) => formatBcsCount(count, "kupalište", "kupališta", "kupališta"),
    seaWaterQualityLabel: "Plaže",
    summaryLabel: "Danas u {city}",
    temperature: "Temperatura",
  },
};

function getMontenegrinEventNoun(count: number) {
  return count % 10 === 1 && count % 100 !== 11 ? "događaj" : "događaja";
}

function capitalize(value: string) {
  return `${value.slice(0, 1).toLocaleUpperCase("sr-Latn-ME")}${value.slice(1)}`;
}

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
