import { createDailyOverview } from "@/modules/daily-overview/domain/daily-overview-generator";
import type { DailyOverview } from "@/modules/daily-overview/domain/daily-overview";
import { mockCachedCityDataProvider } from "@/modules/daily-overview/infrastructure/mock-cached-city-data-provider";
import { getCityAlertsOverviewData } from "@/modules/city-alerts/application/get-active-city-alerts";
import type { CityContext } from "@/shared/types/city";

type DailyOverviewResult =
  { data: DailyOverview; status: "success" } | { status: "empty" } | { status: "error" };

async function getDailyOverview(
  context: CityContext = getDefaultCityContext(),
): Promise<DailyOverviewResult> {
  try {
    const [snapshot, cityAlerts] = await Promise.all([
      mockCachedCityDataProvider.getCachedCityData(context),
      getCityAlertsOverviewData(context),
    ]);

    if (!snapshot) {
      return { status: "empty" };
    }

    const overviewSnapshot = {
      ...snapshot,
      alerts:
        cityAlerts.status === "available"
          ? { data: cityAlerts.alerts, status: "available" as const }
          : { status: "unavailable" as const },
    };

    return { data: createDailyOverview(overviewSnapshot, context), status: "success" };
  } catch {
    return { status: "error" };
  }
}

export { getDailyOverview, type DailyOverviewResult };
import { getDefaultCityContext } from "@/config/city-context";
