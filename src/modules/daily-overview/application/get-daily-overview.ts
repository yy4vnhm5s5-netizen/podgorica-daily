import { createDailyOverview } from "@/modules/daily-overview/domain/daily-overview-generator";
import type { DailyOverview, OverviewLocale } from "@/modules/daily-overview/domain/daily-overview";
import { mockCachedCityDataProvider } from "@/modules/daily-overview/infrastructure/mock-cached-city-data-provider";
import { getCityAlertsOverviewData } from "@/modules/city-alerts/application/get-active-city-alerts";

type DailyOverviewResult =
  { data: DailyOverview; status: "success" } | { status: "empty" } | { status: "error" };

async function getDailyOverview(locale: OverviewLocale): Promise<DailyOverviewResult> {
  try {
    const [snapshot, cityAlerts] = await Promise.all([
      mockCachedCityDataProvider.getCachedCityData(),
      getCityAlertsOverviewData(),
    ]);

    if (!snapshot) {
      return { status: "empty" };
    }

    const overviewSnapshot =
      cityAlerts.providerMode === "mock"
        ? snapshot
        : {
            ...snapshot,
            alerts:
              cityAlerts.status === "available"
                ? { data: cityAlerts.alerts, status: "available" as const }
                : { status: "unavailable" as const },
          };

    return { data: createDailyOverview(overviewSnapshot, locale), status: "success" };
  } catch {
    return { status: "error" };
  }
}

export { getDailyOverview, type DailyOverviewResult };
