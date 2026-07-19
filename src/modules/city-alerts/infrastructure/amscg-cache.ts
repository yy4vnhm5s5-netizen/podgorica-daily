import type { RoadAlert } from "../domain/road-alert.ts";
import { resolveRuntimeCachePath } from "../../../config/runtime-data.ts";
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

const defaultAmscgCachePath = resolveRuntimeCachePath("amscg-road-conditions.json");

function calculateAmscgFreshness(
  fetchedAt: Date | undefined,
  now = new Date(),
  maxAgeMinutes = 90,
): AmscgFreshnessStatus {
  return calculateCacheFreshness(fetchedAt, now, maxAgeMinutes);
}

async function readAmscgCache(
  cachePath = process.env.AMSCG_CACHE_PATH ?? resolveRuntimeCachePath("amscg-road-conditions.json"),
) {
  return readJsonCache<AmscgCacheSnapshot>(cachePath);
}

async function writeAmscgCache(
  snapshot: AmscgCacheSnapshot,
  cachePath = process.env.AMSCG_CACHE_PATH ?? resolveRuntimeCachePath("amscg-road-conditions.json"),
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
