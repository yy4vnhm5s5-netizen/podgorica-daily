import type { RoadAlert } from "../domain/road-alert.ts";
import {
  calculateCacheFreshness,
  readJsonCache,
  writeJsonCache,
} from "../../../shared/lib/cache.ts";

type AmscgFreshnessStatus = "fresh" | "stale" | "unavailable";

interface AmscgCacheSnapshot {
  alerts: RoadAlert[];
  fetchedAt: string;
  freshnessStatus: AmscgFreshnessStatus;
  lastRefreshError?: string;
  lastSuccessfulRefreshAt: string;
  parserWarnings: string[];
  schemaVersion: 1;
  source: "AMSCG";
  sourceUrl: string;
}

const defaultAmscgCachePath = ".runtime/cache/amscg-road-conditions.json";

function calculateAmscgFreshness(
  fetchedAt: Date | undefined,
  now = new Date(),
  maxAgeMinutes = 90,
): AmscgFreshnessStatus {
  return calculateCacheFreshness(fetchedAt, now, maxAgeMinutes);
}

async function readAmscgCache(cachePath = process.env.AMSCG_CACHE_PATH ?? defaultAmscgCachePath) {
  return readJsonCache<AmscgCacheSnapshot>(cachePath);
}

async function writeAmscgCache(
  snapshot: AmscgCacheSnapshot,
  cachePath = process.env.AMSCG_CACHE_PATH ?? defaultAmscgCachePath,
) {
  await writeJsonCache(snapshot, cachePath);
}

export {
  calculateAmscgFreshness,
  defaultAmscgCachePath,
  readAmscgCache,
  writeAmscgCache,
  type AmscgCacheSnapshot,
  type AmscgFreshnessStatus,
};
