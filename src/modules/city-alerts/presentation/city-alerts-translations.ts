import type {
  AlertSeverity,
  AlertType,
  CityAlertContent,
} from "@/modules/city-alerts/domain/city-alert";
import type { Locale } from "@/shared/config/locale";

interface CityAlertsTranslations {
  affectedArea: string;
  area: string;
  cityServices: string;
  content: Record<string, string>;
  emptyDescription: string;
  emptyTitle: string;
  errorDescription: string;
  errorTitle: string;
  expectedEnd: string;
  loading: string;
  lastUpdated: string;
  officialSource: string;
  noPowerOutages: string;
  noWaterInterruptions: string;
  otherAlerts: string;
  power: string;
  publishedAt: string;
  scheduled: string;
  severities: Record<AlertSeverity, string>;
  source: string;
  startsAt: string;
  staleData: string;
  status: string;
  statuses: Record<"active" | "scheduled", string>;
  title: string;
  time: string;
  unavailable: string;
  water: string;
  types: Record<AlertType, string>;
}

const cityAlertsTranslations: Record<Locale, CityAlertsTranslations> = {
  en: {
    affectedArea: "Affected area",
    area: "Area",
    cityServices: "City services",
    content: {
      centar: "City centre",
      citywide: "Across Podgorica",
      demoSource: "City services",
      masline: "Masline",
      resolvedDescription: "This resolved demo alert is intentionally hidden from the active list.",
      resolvedTitle: "Traffic disruption resolved",
      roadWorksDescription: "Road works are affecting traffic in the city centre.",
      roadWorksTitle: "Road works in the city centre",
      waterOutageDescription: "Water service is temporarily interrupted.",
      waterOutageTitle: "Water service interruption",
    },
    emptyDescription: "There are currently no active alerts affecting everyday life in Podgorica.",
    emptyTitle: "No active alerts.",
    errorDescription: "Alerts could not be loaded. Please try again later.",
    errorTitle: "Alerts unavailable",
    expectedEnd: "Expected end",
    loading: "Loading city alerts",
    lastUpdated: "Last successful update",
    officialSource: "Official source",
    noPowerOutages: "No planned power outages",
    noWaterInterruptions: "No water service interruptions",
    otherAlerts: "Important city alerts",
    power: "Power",
    publishedAt: "Published",
    scheduled: "Scheduled",
    severities: {
      critical: "Critical",
      information: "Information",
      resolved: "Resolved",
      warning: "Warning",
    },
    source: "Source",
    startsAt: "Starts",
    staleData: "Data may be outdated. Last successful update:",
    status: "Status",
    statuses: { active: "Active", scheduled: "Scheduled" },
    title: "City alerts",
    time: "Time",
    unavailable: "Data is currently unavailable.",
    water: "Water",
    types: {
      emergency: "Emergency",
      powerOutage: "Power outage",
      roadWorks: "Road works",
      trafficDisruption: "Traffic disruption",
      waterOutage: "Water outage",
      weatherWarning: "Weather warning",
    },
  },
  me: {
    affectedArea: "Pogođeno područje",
    area: "Područje",
    cityServices: "Gradske usluge",
    content: {
      centar: "Centar grada",
      citywide: "Širom Podgorice",
      demoSource: "Gradske usluge",
      masline: "Masline",
      resolvedDescription: "Ovo riješeno demo obavještenje namjerno je sakriveno iz aktivne liste.",
      resolvedTitle: "Saobraćajna smetnja je otklonjena",
      roadWorksDescription: "Radovi na putu utiču na saobraćaj u centru grada.",
      roadWorksTitle: "Radovi na putu u centru grada",
      waterOutageDescription: "Vodosnabdijevanje je privremeno prekinuto.",
      waterOutageTitle: "Prekid vodosnabdijevanja",
    },
    emptyDescription: "Nema aktivnih obavještenja.",
    emptyTitle: "Nema aktivnih obavještenja.",
    errorDescription: "Obavještenja nije moguće učitati. Pokušajte ponovo kasnije.",
    errorTitle: "Obavještenja nijesu dostupna",
    expectedEnd: "Očekivani završetak",
    loading: "Učitavanje gradskih obavještenja",
    lastUpdated: "Posljednje uspješno ažuriranje",
    officialSource: "Zvanični izvor",
    noPowerOutages: "Nema planiranih prekida struje",
    noWaterInterruptions: "Nema aktivnih obavještenja o prekidima u vodosnabdijevanju.",
    otherAlerts: "Važna gradska obavještenja",
    power: "Struja",
    publishedAt: "Objavljeno",
    scheduled: "Planirano",
    severities: {
      critical: "Kritično",
      information: "Informacija",
      resolved: "Riješeno",
      warning: "Upozorenje",
    },
    source: "Izvor",
    startsAt: "Početak",
    staleData: "Podaci mogu biti zastarjeli. Posljednje uspješno ažuriranje:",
    status: "Status",
    statuses: { active: "Aktivno", scheduled: "Planirano" },
    title: "Gradska obavještenja",
    time: "Vrijeme",
    unavailable: "Podaci trenutno nijesu dostupni.",
    water: "Voda",
    types: {
      emergency: "Hitno stanje",
      powerOutage: "Prekid napajanja električnom energijom",
      roadWorks: "Radovi na putu",
      trafficDisruption: "Saobraćajna smetnja",
      waterOutage: "Prekid vodosnabdijevanja",
      weatherWarning: "Vremensko upozorenje",
    },
  },
};

function getCityAlertsTranslations(locale: Locale) {
  return cityAlertsTranslations[locale];
}

function getCityAlertContent(content: CityAlertContent, translations: CityAlertsTranslations) {
  return content.kind === "demo"
    ? (translations.content[content.key] ?? content.key)
    : content.value;
}

export { getCityAlertContent, getCityAlertsTranslations, type CityAlertsTranslations };
