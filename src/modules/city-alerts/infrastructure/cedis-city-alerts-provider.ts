import type { CityAlert } from "../domain/city-alert.ts";
import {
  defaultCachePath,
  getCedisCachePath,
  readCedisCache,
  type CedisCacheSnapshot,
  type FreshnessStatus,
} from "./cedis-cache.ts";
import { cedisMunicipalities, getCedisCityId, type CedisSupportedCityId } from "./cedis-cities.ts";
import { mockCityAlertsProvider } from "./mock-city-alerts-provider.ts";
import { isCitySupportedByProvider } from "@/shared/config/cities";
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
  now?: () => Date;
  readCache?: (cityId: CedisSupportedCityId) => Promise<CedisCacheSnapshot | null>;
}

async function getCedisCityAlerts({
  context,
  getMockAlerts = () => mockCityAlertsProvider.getCityAlerts(),
  mode,
  now = () => new Date(),
  readCache = (cityId) => readCedisCache(getCedisCachePath(cityId), undefined, cityId),
}: CedisCityAlertsProviderDependencies): Promise<CityAlertsSourceData> {
  if (
    mode === "disabled" ||
    !isCitySupportedByProvider(context.city, cedisProviderMetadata.supportedCityIds)
  ) {
    return { alerts: [], freshnessStatus: "unavailable", mode };
  }
  const cityId = getCedisCityId(context);
  if (!cityId) return { alerts: [], freshnessStatus: "unavailable", mode };

  if (mode === "mock") {
    return { alerts: (await getMockAlerts()) ?? [], freshnessStatus: "fresh", mode };
  }

  const cache = await readCache(cityId);
  if (!cache) {
    return { alerts: [], freshnessStatus: "unavailable", mode };
  }

  return {
    alerts: cache.alerts
      .filter((alert) => alert.cityIds.length === 1 && alert.cityIds[0] === cityId)
      .map((alert) => refreshCedisAlertStatus(alert, now())),
    freshnessStatus: cache.freshnessStatus,
    lastSuccessfulUpdate: new Date(cache.lastSuccessfulRefreshAt),
    mode,
  };
}

function refreshCedisAlertStatus(alert: CityAlert, now: Date): CityAlert {
  if (alert.expectedEndAt && alert.expectedEndAt <= now) {
    return { ...alert, status: "expired" };
  }

  if (alert.startsAt && alert.startsAt > now) {
    return { ...alert, status: "scheduled" };
  }

  const fallbackTimestamp = alert.startsAt ?? alert.publishedAt;
  if (fallbackTimestamp && now.getTime() - fallbackTimestamp.getTime() >= 24 * 60 * 60 * 1000) {
    return { ...alert, status: "expired" };
  }

  if (alert.status === "expired") return alert;

  return { ...alert, status: "active" };
}

const cedisProviderMetadata: ProviderMetadata = {
  cachePath: defaultCachePath,
  displayName: "CEDIS planned outages",
  enabled: true,
  id: "cedis",
  officialSource: "https://cedis.me/servisne-informacije/",
  refreshIntervalMinutes: 360,
  // Derived from cedisMunicipalities rather than restated. This list is the read-side gate: a city
  // missing from it is refused here, before the snapshot file is ever opened, so the page renders
  // the provider-unavailable state even though collection succeeded and wrote a valid snapshot.
  // Keeping it hand-maintained let read coverage silently drift behind collection coverage — Ulcinj
  // was collected successfully (acceptedCount 1) while /ulcinj/struja reported no data.
  supportedCityIds: Object.values(cedisMunicipalities).map(({ cityId }) => cityId),
  supportsMultipleCities: true,
};

export {
  cedisProviderMetadata,
  getCedisCityAlerts,
  type CedisCityAlertsProviderDependencies,
  type CityAlertsProviderMode,
  type CityAlertsSourceData,
};
