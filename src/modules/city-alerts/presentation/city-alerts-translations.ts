import type {
  AlertSeverity,
  AlertType,
  CityAlertContent,
} from "@/modules/city-alerts/domain/city-alert";
import type { Locale } from "@/shared/config/locale";

interface CityAlertsTranslations {
  affectedArea: string;
  content: Record<string, string>;
  demo: string;
  demoNotice: string;
  emptyDescription: string;
  emptyTitle: string;
  errorDescription: string;
  errorTitle: string;
  expectedEnd: string;
  loading: string;
  lastUpdated: string;
  officialSource: string;
  severities: Record<AlertSeverity, string>;
  source: string;
  startsAt: string;
  staleData: string;
  status: string;
  statuses: Record<"active" | "scheduled", string>;
  title: string;
  unavailable: string;
  types: Record<AlertType, string>;
}

const cityAlertsTranslations: Record<Locale, CityAlertsTranslations> = {
  en: {
    affectedArea: "Affected area",
    content: {
      centar: "City centre",
      citywide: "Across Podgorica",
      demoSource: "Demo source",
      masline: "Masline",
      resolvedDescription: "This resolved demo alert is intentionally hidden from the active list.",
      resolvedTitle: "Traffic disruption resolved",
      roadWorksDescription:
        "A temporary roadworks notice is shown here for interface preview only.",
      roadWorksTitle: "Road works in the city centre",
      waterOutageDescription:
        "A temporary water service interruption is shown here for interface preview only.",
      waterOutageTitle: "Water service interruption",
    },
    demo: "Demo",
    demoNotice:
      "These are demo alerts. Production alerts will come from configured verified sources.",
    emptyDescription: "There are currently no active alerts affecting everyday life in Podgorica.",
    emptyTitle: "No active alerts.",
    errorDescription: "Alerts could not be loaded. Please try again later.",
    errorTitle: "Alerts unavailable",
    expectedEnd: "Expected end",
    loading: "Loading city alerts",
    lastUpdated: "Last successful update",
    officialSource: "Official source",
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
    unavailable: "CEDIS data is currently unavailable.",
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
    content: {
      centar: "Centar grada",
      citywide: "Širom Podgorice",
      demoSource: "Demo izvor",
      masline: "Masline",
      resolvedDescription: "Ovo riješeno demo obavještenje namjerno je sakriveno iz aktivne liste.",
      resolvedTitle: "Saobraćajna smetnja je otklonjena",
      roadWorksDescription:
        "Privremeno obavještenje o radovima na putu prikazano je samo za pregled interfejsa.",
      roadWorksTitle: "Radovi na putu u centru grada",
      waterOutageDescription:
        "Privremeni prekid vodosnabdijevanja prikazan je samo za pregled interfejsa.",
      waterOutageTitle: "Prekid vodosnabdijevanja",
    },
    demo: "Demo",
    demoNotice:
      "Ovo su demo obavještenja. Produkcijska obavještenja dolaziće iz podešenih, provjerenih izvora.",
    emptyDescription: "Nema aktivnih obavještenja.",
    emptyTitle: "Nema aktivnih obavještenja.",
    errorDescription: "Obavještenja nije moguće učitati. Pokušajte ponovo kasnije.",
    errorTitle: "Obavještenja nijesu dostupna",
    expectedEnd: "Očekivani završetak",
    loading: "Učitavanje gradskih obavještenja",
    lastUpdated: "Posljednje uspješno ažuriranje",
    officialSource: "Zvanični izvor",
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
    unavailable: "CEDIS podaci trenutno nijesu dostupni.",
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
