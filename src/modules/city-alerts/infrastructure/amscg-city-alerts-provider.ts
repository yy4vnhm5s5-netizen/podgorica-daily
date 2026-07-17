import type { CityAlert } from "../domain/city-alert.ts";
import type { RoadAlert } from "../domain/road-alert.ts";
import { readAmscgCache, type AmscgCacheSnapshot } from "./amscg-cache.ts";

type AmscgProviderMode = "disabled" | "live";

interface AmscgCityAlertsSourceData {
  alerts: CityAlert[];
  freshnessStatus: "fresh" | "stale" | "unavailable";
  lastSuccessfulUpdate?: Date;
  mode: AmscgProviderMode;
}

async function getAmscgCityAlerts({
  mode,
  readCache = readAmscgCache,
}: {
  mode: AmscgProviderMode;
  readCache?: () => Promise<AmscgCacheSnapshot | null>;
}): Promise<AmscgCityAlertsSourceData> {
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

export { getAmscgCityAlerts, type AmscgCityAlertsSourceData, type AmscgProviderMode };
