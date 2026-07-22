import { getDefaultCityContext, supportsCityAlerts } from "@/config/city-context";
import { createDailyOverview } from "@/modules/daily-overview/domain/daily-overview-generator";
import type { DailyOverview } from "@/modules/daily-overview/domain/daily-overview";
import { mockCachedCityDataProvider } from "@/modules/daily-overview/infrastructure/mock-cached-city-data-provider";
import { getCityAlertsOverviewData } from "@/modules/city-alerts/application/get-active-city-alerts";
import type { CityContext } from "@/shared/types/city";

type DailyOverviewResult =
  { data: DailyOverview; status: "success" } | { status: "empty" } | { status: "error" };

interface DailyOverviewOptions {
  includeCityAlerts?: boolean;
}

function shouldIncludeCityAlerts(context: CityContext, requested = true) {
  return requested && supportsCityAlerts(context.city);
}

async function getDailyOverview(
  context: CityContext = getDefaultCityContext(),
  options: DailyOverviewOptions = {},
): Promise<DailyOverviewResult> {
  try {
    const snapshotPromise = mockCachedCityDataProvider.getCachedCityData(context);
    const cityAlertsPromise = shouldIncludeCityAlerts(context, options.includeCityAlerts ?? true)
      ? getCityAlertsOverviewData(context)
      : Promise.resolve({ alerts: [], status: "unavailable" as const });
    const [snapshot, cityAlerts] = await Promise.all([snapshotPromise, cityAlertsPromise]);

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

export {
  getDailyOverview,
  type DailyOverviewOptions,
  type DailyOverviewResult,
  shouldIncludeCityAlerts,
};
