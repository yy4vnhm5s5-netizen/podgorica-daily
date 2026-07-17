import type { CityAlert } from "../domain/city-alert.ts";
import type { RoadAlert } from "../domain/road-alert.ts";
import { readAmscgCache, type AmscgCacheSnapshot } from "./amscg-cache.ts";
import type { CityContext } from "@/shared/types/city";
import type { ProviderMetadata } from "@/shared/types/provider";

type AmscgProviderMode = "disabled" | "live";

interface AmscgCityAlertsSourceData {
  alerts: CityAlert[];
  freshnessStatus: "fresh" | "stale" | "unavailable";
  lastSuccessfulUpdate?: Date;
  mode: AmscgProviderMode;
}

async function getAmscgCityAlerts({
  context,
  mode,
  readCache = readAmscgCache,
}: {
  context: CityContext;
  mode: AmscgProviderMode;
  readCache?: () => Promise<AmscgCacheSnapshot | null>;
}): Promise<AmscgCityAlertsSourceData> {
  void context;
  if (mode === "disabled") return { alerts: [], freshnessStatus: "unavailable", mode };
  const cache = await readCache();
  if (!cache) return { alerts: [], freshnessStatus: "unavailable", mode };
  return {
    alerts: cache.alerts.map(toCityAlert),
    freshnessStatus: cache.freshnessStatus,
    lastSuccessfulUpdate: new Date(cache.lastSuccessfulRefreshAt),
    mode,
  };
}

function toCityAlert(alert: RoadAlert): CityAlert {
  return {
    affectedArea: { kind: "source", value: alert.affectedRoad },
    dataMode: "live",
    cityIds: alert.cityIds,
    description: { kind: "source", value: alert.description },
    expectedEndAt: alert.validUntil,
    id: `amscg-${alert.id}`,
    severity: alert.type === "closure" || alert.type === "warning" ? "warning" : "information",
    source: { kind: "source", value: "AMSCG" },
    sourceUrl: alert.sourceUrl,
    startsAt: alert.validFrom,
    status: "active",
    title: { kind: "source", value: alert.title },
    type: alert.type === "roadwork" ? "roadWorks" : "trafficDisruption",
  };
}

const amscgProviderMetadata: ProviderMetadata = {
  cachePath: ".runtime/cache/amscg-road-conditions.json",
  displayName: "AMSCG road conditions",
  enabled: true,
  id: "amscg",
  officialSource: "https://amscg.org/stanje-na-putevima/",
  refreshIntervalMinutes: 60,
  supportsMultipleCities: true,
};

export {
  amscgProviderMetadata,
  getAmscgCityAlerts,
  type AmscgCityAlertsSourceData,
  type AmscgProviderMode,
};
