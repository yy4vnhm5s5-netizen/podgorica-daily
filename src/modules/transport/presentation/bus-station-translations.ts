import type { Locale } from "@/shared/config/locale";

interface BusStationTranslations {
  description: (cityName: string) => string;
  externalService: string;
  openDepartures: string;
  title: string;
}

const busStationTranslations: Record<Locale, BusStationTranslations> = {
  en: {
    description: (cityName) => `Timetables and tickets for travel from ${cityName}.`,
    externalService: "BusTicket4.me",
    openDepartures: "Check departures →",
    title: "Bus station",
  },
  me: {
    description: (cityName) => `Red vožnje i karte za putovanja iz ${cityName}.`,
    externalService: "BusTicket4.me",
    openDepartures: "Provjeri polaske →",
    title: "Autobuska stanica",
  },
};

function getBusStationTranslations(locale: Locale) {
  return busStationTranslations[locale];
}

export { getBusStationTranslations, type BusStationTranslations };
