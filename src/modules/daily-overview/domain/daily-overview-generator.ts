import type {
  AirQualityCategory,
  CityDataSnapshot,
  DailyOverview,
  OverviewAlert,
  OverviewLocale,
} from "./daily-overview.ts";
import type { CityContext } from "@/shared/types/city";

interface OverviewCopy {
  airQuality: (category: AirQualityCategory) => string;
  criticalAlerts: (count: number) => string;
  dataAvailable: string;
  events: (count: number) => string;
  eventsThisWeekend: (count: number) => string;
  concertsThisEvening: (count: number) => string;
  noActiveAlerts: string;
  noData: readonly string[];
  powerOutages: (count: number) => string;
  upcomingPowerOutages: (count: number) => string;
  roadWorks: (count: number) => string;
  trafficDisruptions: (count: number) => string;
  unusualTemperature: (temperature: number, cityName: string) => string;
  waterOutages: (count: number) => string;
  weatherWarnings: (count: number) => string;
}

const overviewCopy: Record<OverviewLocale, OverviewCopy> = {
  en: {
    airQuality: (category) =>
      `Air quality is currently reported as ${
        { good: "good", moderate: "moderate", unhealthy: "unhealthy" }[category]
      }.`,
    criticalAlerts: (count) =>
      count === 1
        ? "There is one critical city alert."
        : `There are ${count} critical city alerts.`,
    dataAvailable: "This overview is based on the currently available verified data.",
    events: (count) => {
      if (count === 0) {
        return "There are no events listed for today.";
      }

      return count === 1
        ? "There is one event listed for today."
        : `There are ${count} events listed for today.`;
    },
    concertsThisEvening: (count) =>
      count === 1
        ? "One concert is scheduled this evening."
        : `${toEnglishCountWord(count)} concerts are scheduled this evening.`,
    eventsThisWeekend: (count) =>
      count === 1
        ? "One event is scheduled for the weekend."
        : `${toEnglishCountWord(count)} events are scheduled for the weekend.`,
    noActiveAlerts: "There are no active city disruptions at the moment.",
    noData: [
      "There is not enough verified city data available for an overview right now.",
      "The overview will be updated when current data becomes available.",
    ],
    powerOutages: (count) =>
      count === 1 ? "One power outage is active." : `${count} power outages are active.`,
    upcomingPowerOutages: (count) =>
      count === 1
        ? "One planned power outage is upcoming."
        : `${count} planned power outages are upcoming.`,
    roadWorks: (count) =>
      count === 1
        ? "Road works are affecting one area."
        : `Road works are affecting ${count} areas.`,
    trafficDisruptions: (count) =>
      count === 1
        ? "A major traffic disruption is active."
        : `${count} major traffic disruptions are active.`,
    unusualTemperature: (temperature, cityName) =>
      `The temperature is unusually ${temperature.toFixed(1)}°C for ${cityName}.`,
    waterOutages: (count) =>
      count === 1 ? "One water outage is active." : `${count} water outages are active.`,
    weatherWarnings: (count) =>
      count === 1 ? "A weather warning is active." : `${count} weather warnings are active.`,
  },
  me: {
    airQuality: (category) =>
      `Kvalitet vazduha trenutno je označen kao: ${
        { good: "dobar", moderate: "umjeren", unhealthy: "nezdrav" }[category]
      }.`,
    criticalAlerts: (count) =>
      count === 1
        ? "Aktivno je jedno kritično gradsko obavještenje."
        : `Aktivna su ${count} kritična gradska obavještenja.`,
    dataAvailable: "Ovaj pregled zasniva se na trenutno dostupnim provjerenim podacima.",
    events: (count) => {
      if (count === 0) {
        return "Za danas nema najavljenih događaja.";
      }

      return count === 1
        ? "Za danas je najavljen jedan događaj."
        : `Za danas su najavljena ${count} događaja.`;
    },
    concertsThisEvening: (count) =>
      count === 1
        ? "Večeras je najavljen jedan koncert."
        : `Večeras su najavljena ${count} koncerta.`,
    eventsThisWeekend: (count) =>
      count === 1
        ? "Za vikend je najavljen jedan događaj."
        : `Za vikend je najavljeno ${count} događaja.`,
    noActiveAlerts: "Nema aktivnih gradskih smetnji.",
    noData: [
      "Trenutno nema dovoljno provjerenih gradskih podataka za dnevni pregled.",
      "Pregled će biti ažuriran kada aktuelni podaci postanu dostupni.",
    ],
    powerOutages: (count) =>
      count === 1
        ? "Aktivan je jedan prekid napajanja električnom energijom."
        : `Aktivna su ${count} prekida napajanja električnom energijom.`,
    upcomingPowerOutages: (count) =>
      count === 1
        ? "Planiran je jedan prekid napajanja električnom energijom."
        : `Planirana su ${count} prekida napajanja električnom energijom.`,
    roadWorks: (count) =>
      count === 1
        ? "Radovi na putu utiču na jedno područje."
        : `Radovi na putu utiču na ${count} područja.`,
    trafficDisruptions: (count) =>
      count === 1
        ? "Aktivna je velika saobraćajna smetnja."
        : `Aktivne su ${count} velike saobraćajne smetnje.`,
    unusualTemperature: (temperature, cityName) =>
      `Temperatura od ${temperature.toFixed(1)}°C neuobičajena je za ${cityName}.`,
    waterOutages: (count) =>
      count === 1
        ? "Aktivan je jedan prekid vodosnabdijevanja."
        : `Aktivna su ${count} prekida vodosnabdijevanja.`,
    weatherWarnings: (count) =>
      count === 1
        ? "Aktivno je jedno vremensko upozorenje."
        : `Aktivna su ${count} vremenska upozorenja.`,
  },
};

function createDailyOverview(snapshot: CityDataSnapshot, context: CityContext): DailyOverview {
  const copy = overviewCopy[context.locale];
  const activeAlerts = getActiveAlerts(snapshot);

  if (!hasAvailableData(snapshot)) {
    return {
      generatedAt: snapshot.generatedAt,
      isDemoData: snapshot.isDemoData,
      sentences: copy.noData,
    };
  }

  const sentences = [
    getCriticalAlertsSentence(activeAlerts, copy),
    getWeatherWarningsSentence(activeAlerts, copy),
    getPowerOutagesSentence(snapshot, activeAlerts, copy),
    getWaterOutagesSentence(activeAlerts, copy),
    getTrafficDisruptionsSentence(activeAlerts, copy),
    getRoadWorksSentence(activeAlerts, copy),
    getUnusualTemperatureSentence(snapshot, copy, context.city.displayName),
    getEventsSentence(snapshot, copy),
    getAirQualitySentence(snapshot, copy),
  ].filter((sentence): sentence is string => sentence !== null);

  if (snapshot.alerts.status === "available" && activeAlerts.length === 0) {
    sentences.unshift(copy.noActiveAlerts);
  }

  if (sentences.length < 2) {
    sentences.push(copy.dataAvailable);
  }

  return {
    generatedAt: snapshot.generatedAt,
    isDemoData: snapshot.isDemoData,
    sentences: sentences.slice(0, 5),
  };
}

function getActiveAlerts(snapshot: CityDataSnapshot) {
  return snapshot.alerts.status === "available"
    ? snapshot.alerts.data.filter(({ isActive }) => isActive)
    : [];
}

function hasAvailableData(snapshot: CityDataSnapshot) {
  return [snapshot.airQuality, snapshot.alerts, snapshot.events, snapshot.weather].some(
    ({ status }) => status === "available",
  );
}

function getCriticalAlertsSentence(alerts: readonly OverviewAlert[], copy: OverviewCopy) {
  const count = alerts.filter(({ severity }) => severity === "critical").length;

  return count > 0 ? copy.criticalAlerts(count) : null;
}

function getWeatherWarningsSentence(alerts: readonly OverviewAlert[], copy: OverviewCopy) {
  return getAlertTypeSentence(alerts, "weatherWarning", copy.weatherWarnings);
}

function getPowerOutagesSentence(
  snapshot: CityDataSnapshot,
  alerts: readonly OverviewAlert[],
  copy: OverviewCopy,
) {
  const activeCount = alerts.filter(
    ({ isActive, type }) => type === "powerOutage" && isActive,
  ).length;
  const upcomingCount =
    snapshot.alerts.status === "available"
      ? snapshot.alerts.data.filter(({ isUpcoming, type }) => type === "powerOutage" && isUpcoming)
          .length
      : 0;

  return activeCount > 0
    ? copy.powerOutages(activeCount)
    : upcomingCount > 0
      ? copy.upcomingPowerOutages(upcomingCount)
      : null;
}

function getWaterOutagesSentence(alerts: readonly OverviewAlert[], copy: OverviewCopy) {
  return getAlertTypeSentence(alerts, "waterOutage", copy.waterOutages);
}

function getTrafficDisruptionsSentence(alerts: readonly OverviewAlert[], copy: OverviewCopy) {
  const count = alerts.filter(
    ({ isMajor, type }) => type === "trafficDisruption" && isMajor,
  ).length;

  return count > 0 ? copy.trafficDisruptions(count) : null;
}

function getRoadWorksSentence(alerts: readonly OverviewAlert[], copy: OverviewCopy) {
  return getAlertTypeSentence(alerts, "roadWorks", copy.roadWorks);
}

function getAlertTypeSentence(
  alerts: readonly OverviewAlert[],
  type: OverviewAlert["type"],
  sentence: (count: number) => string,
) {
  const count = alerts.filter((alert) => alert.type === type).length;

  return count > 0 ? sentence(count) : null;
}

function getUnusualTemperatureSentence(
  snapshot: CityDataSnapshot,
  copy: OverviewCopy,
  cityName: string,
) {
  if (snapshot.weather.status === "unavailable") {
    return null;
  }

  const { temperatureCelsius } = snapshot.weather.data;

  return isUnusualTemperature(temperatureCelsius)
    ? copy.unusualTemperature(temperatureCelsius, cityName)
    : null;
}

function getEventsSentence(snapshot: CityDataSnapshot, copy: OverviewCopy) {
  if (snapshot.events.status === "unavailable") {
    return null;
  }

  const { concertsThisEvening, eventsThisWeekend, eventsToday, count } = snapshot.events.data;
  if (concertsThisEvening && concertsThisEvening > 0)
    return copy.concertsThisEvening(concertsThisEvening);
  if (eventsThisWeekend && eventsThisWeekend > 0) return copy.eventsThisWeekend(eventsThisWeekend);
  return copy.events(eventsToday ?? count);
}

function getAirQualitySentence(snapshot: CityDataSnapshot, copy: OverviewCopy) {
  return snapshot.airQuality.status === "available"
    ? copy.airQuality(snapshot.airQuality.data.category)
    : null;
}

function isUnusualTemperature(temperatureCelsius: number) {
  return temperatureCelsius <= 0 || temperatureCelsius >= 32;
}

function toEnglishCountWord(count: number) {
  return (
    {
      2: "Two",
      3: "Three",
      4: "Four",
      5: "Five",
      6: "Six",
      7: "Seven",
      8: "Eight",
      9: "Nine",
      10: "Ten",
    }[count] ?? String(count)
  );
}

export { createDailyOverview, isUnusualTemperature };
