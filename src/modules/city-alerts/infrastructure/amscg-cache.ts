import type { RoadAlert } from "../domain/road-alert.ts";
import { deserializeRoadAlerts } from "./city-alert-cache-deserialization.ts";
import { env } from "../../../config/env.ts";
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

const defaultAmscgCachePath = env.AMSCG_CACHE_PATH;

function calculateAmscgFreshness(
  fetchedAt: Date | undefined,
  now = new Date(),
  maxAgeMinutes = 90,
): AmscgFreshnessStatus {
  return calculateCacheFreshness(fetchedAt, now, maxAgeMinutes);
}

async function readAmscgCache(cachePath = env.AMSCG_CACHE_PATH) {
  const snapshot = await readJsonCache<unknown>(cachePath);
  return deserializeAmscgCacheSnapshot(snapshot);
}

async function writeAmscgCache(snapshot: AmscgCacheSnapshot, cachePath = env.AMSCG_CACHE_PATH) {
  await writeJsonCache(snapshot, cachePath);
}

function deserializeAmscgCacheSnapshot(value: unknown): AmscgCacheSnapshot | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.source !== "AMSCG") return null;

  const alerts = deserializeRoadAlerts(value.alerts);
  if (
    !alerts ||
    !isString(value.fetchedAt) ||
    !isFreshnessStatus(value.freshnessStatus) ||
    !isString(value.lastSuccessfulRefreshAt) ||
    !isStringArray(value.parserWarnings) ||
    !isString(value.sourceUrl) ||
    !isOptionalString(value.lastRefreshError)
  ) {
    return null;
  }

  return {
    alerts,
    fetchedAt: value.fetchedAt,
    freshnessStatus: value.freshnessStatus,
    ...(value.lastRefreshError ? { lastRefreshError: value.lastRefreshError } : {}),
    lastSuccessfulRefreshAt: value.lastSuccessfulRefreshAt,
    parserWarnings: value.parserWarnings,
    schemaVersion: 1,
    source: "AMSCG",
    sourceUrl: value.sourceUrl,
  };
}

function isFreshnessStatus(value: unknown): value is AmscgFreshnessStatus {
  return value === "fresh" || value === "stale" || value === "unavailable";
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

export {
  calculateAmscgFreshness,
  defaultAmscgCachePath,
  readAmscgCache,
  writeAmscgCache,
  type AmscgCacheSnapshot,
  type AmscgFreshnessStatus,
};
