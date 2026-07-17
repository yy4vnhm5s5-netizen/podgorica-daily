import type { CityAlert } from "@/modules/city-alerts/domain/city-alert";
import { mockCityAlertsProvider } from "@/modules/city-alerts/infrastructure/mock-city-alerts-provider";

type CityAlertsResult =
  { data: CityAlert[]; status: "success" } | { status: "empty" } | { status: "error" };

async function getActiveCityAlerts(): Promise<CityAlertsResult> {
  try {
    const alerts = await mockCityAlertsProvider.getCityAlerts();

    if (!alerts) {
      return { status: "empty" };
    }

    const activeAlerts = alerts.filter(({ severity }) => severity !== "resolved");

    if (activeAlerts.length === 0) {
      return { status: "empty" };
    }

    return { data: activeAlerts, status: "success" };
  } catch {
    return { status: "error" };
  }
}

export { getActiveCityAlerts, type CityAlertsResult };
