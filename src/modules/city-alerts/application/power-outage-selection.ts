import type { CityAlert } from "../domain/city-alert.ts";

const homepageLocationLimit = 6;

function getRelevantPowerOutages(alerts: readonly CityAlert[]) {
  return alerts
    .filter(
      (alert) =>
        alert.type === "powerOutage" && (alert.status === "active" || alert.status === "scheduled"),
    )
    .toSorted((left, right) => getAlertTime(left) - getAlertTime(right));
}

function getPowerOutageLocations(alert: CityAlert) {
  const value = alert.affectedArea.kind === "source" ? alert.affectedArea.value : "";

  return value
    .split(/\s*,\s*/)
    .map((location) => location.trim())
    .filter(Boolean);
}

function getHomepagePowerOutageLocations(alert: CityAlert) {
  const locations = getPowerOutageLocations(alert);
  return {
    additionalLocationCount: Math.max(0, locations.length - homepageLocationLimit),
    locations: locations.slice(0, homepageLocationLimit),
  };
}

function getAlertTime(alert: CityAlert) {
  return alert.startsAt?.getTime() ?? alert.publishedAt?.getTime() ?? Number.POSITIVE_INFINITY;
}

export {
  getHomepagePowerOutageLocations,
  getPowerOutageLocations,
  getRelevantPowerOutages,
  homepageLocationLimit,
};
