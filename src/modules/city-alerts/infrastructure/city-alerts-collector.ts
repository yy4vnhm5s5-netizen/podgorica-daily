type CityAlertCollectorCacheStatus = "fresh" | "stale" | "unavailable";
type CityAlertCollectorStatus = "already-running" | "retained" | "success" | "unavailable";

interface CityAlertCollectorSummary {
  alertCount: number;
  cachePath: string;
  cacheStatus: CityAlertCollectorCacheStatus;
  completedAt: string;
  errorCode?: string;
  retainedPreviousSnapshot: boolean;
  status: CityAlertCollectorStatus;
  warnings: string[];
}

interface CityAlertCollectorResult {
  exitCode: 0 | 1;
  summary: CityAlertCollectorSummary;
}

export {
  type CityAlertCollectorCacheStatus,
  type CityAlertCollectorResult,
  type CityAlertCollectorStatus,
  type CityAlertCollectorSummary,
};
