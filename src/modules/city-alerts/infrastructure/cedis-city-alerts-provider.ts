import type { CityAlert } from "../domain/city-alert.ts";
import {
  defaultCachePath,
  readCedisCache,
  type CedisCacheSnapshot,
  type FreshnessStatus,
} from "./cedis-cache.ts";
import { mockCityAlertsProvider } from "./mock-city-alerts-provider.ts";
import type { CityContext } from "@/shared/types/city";
import type { ProviderMetadata } from "@/shared/types/provider";

type CityAlertsProviderMode = "disabled" | "live" | "mock";

interface CityAlertsSourceData {
  alerts: CityAlert[];
  freshnessStatus: FreshnessStatus;
  lastSuccessfulUpdate?: Date;
  mode: CityAlertsProviderMode;
}

interface CedisCityAlertsProviderDependencies {
  context: CityContext;
  getMockAlerts?: () => Promise<CityAlert[] | null>;
  mode: CityAlertsProviderMode;
  readCache?: () => Promise<CedisCacheSnapshot | null>;
}

async function getCedisCityAlerts({
  context,
  getMockAlerts = () => mockCityAlertsProvider.getCityAlerts(),
  mode,
  readCache = readCedisCache,
}: CedisCityAlertsProviderDependencies): Promise<CityAlertsSourceData> {
  void context;
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

const cedisProviderMetadata: ProviderMetadata = {
  cachePath: defaultCachePath,
  displayName: "CEDIS planned outages",
  enabled: true,
  id: "cedis",
  officialSource: "https://cedis.me/servisne-informacije/",
  refreshIntervalMinutes: 60,
  supportsMultipleCities: false,
};

export {
  cedisProviderMetadata,
  getCedisCityAlerts,
  type CedisCityAlertsProviderDependencies,
  type CityAlertsProviderMode,
  type CityAlertsSourceData,
};
