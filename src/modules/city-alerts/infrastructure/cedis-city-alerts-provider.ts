import type { CityAlert } from "../domain/city-alert.ts";
import { readCedisCache, type CedisCacheSnapshot, type FreshnessStatus } from "./cedis-cache.ts";
import { mockCityAlertsProvider } from "./mock-city-alerts-provider.ts";

type CityAlertsProviderMode = "disabled" | "live" | "mock";

interface CityAlertsSourceData {
  alerts: CityAlert[];
  freshnessStatus: FreshnessStatus;
  lastSuccessfulUpdate?: Date;
  mode: CityAlertsProviderMode;
}

interface CedisCityAlertsProviderDependencies {
  getMockAlerts?: () => Promise<CityAlert[] | null>;
  mode: CityAlertsProviderMode;
  readCache?: () => Promise<CedisCacheSnapshot | null>;
}

async function getCedisCityAlerts({
  getMockAlerts = () => mockCityAlertsProvider.getCityAlerts(),
  mode,
  readCache = readCedisCache,
}: CedisCityAlertsProviderDependencies): Promise<CityAlertsSourceData> {
  if (mode === "disabled") {
    return { alerts: [], freshnessStatus: "unavailable", mode };
  }

  if (mode === "mock") {
    return { alerts: (await getMockAlerts()) ?? [], freshnessStatus: "fresh", mode };
  }

  const cache = await readCache();
  if (!cache) {
    return { alerts: [], freshnessStatus: "unavailable", mode };
  }

  return {
    alerts: cache.alerts,
    freshnessStatus: cache.freshnessStatus,
    lastSuccessfulUpdate: new Date(cache.lastSuccessfulRefreshAt),
    mode,
  };
}

export {
  getCedisCityAlerts,
  type CedisCityAlertsProviderDependencies,
  type CityAlertsProviderMode,
  type CityAlertsSourceData,
};
