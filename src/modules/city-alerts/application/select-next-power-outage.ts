import type { CityAlert } from "@/modules/city-alerts/domain/city-alert";

function selectNextPowerOutage(alerts: readonly CityAlert[]) {
  return alerts
    .filter(({ type }) => type === "powerOutage")
    .toSorted((left, right) => {
      const byStart = getAlertTimestamp(left) - getAlertTimestamp(right);
      return byStart !== 0 ? byStart : left.id.localeCompare(right.id);
    })[0];
}

function getAlertTimestamp(alert: CityAlert) {
  return alert.startsAt?.getTime() ?? alert.publishedAt?.getTime() ?? Number.POSITIVE_INFINITY;
}

export { selectNextPowerOutage };
