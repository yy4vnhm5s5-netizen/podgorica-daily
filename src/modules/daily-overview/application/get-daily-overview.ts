import { createDailyOverview } from "@/modules/daily-overview/domain/daily-overview-generator";
import type { DailyOverview, OverviewLocale } from "@/modules/daily-overview/domain/daily-overview";
import { mockCachedCityDataProvider } from "@/modules/daily-overview/infrastructure/mock-cached-city-data-provider";

type DailyOverviewResult =
  { data: DailyOverview; status: "success" } | { status: "empty" } | { status: "error" };

async function getDailyOverview(locale: OverviewLocale): Promise<DailyOverviewResult> {
  try {
    const snapshot = await mockCachedCityDataProvider.getCachedCityData();

    if (!snapshot) {
      return { status: "empty" };
    }

    return { data: createDailyOverview(snapshot, locale), status: "success" };
  } catch {
    return { status: "error" };
  }
}

export { getDailyOverview, type DailyOverviewResult };
