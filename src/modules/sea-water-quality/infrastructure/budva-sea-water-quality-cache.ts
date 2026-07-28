import { env } from "../../../config/env.ts";
import {
  calculateCacheFreshness,
  nodeFileSystem,
  readJsonCache,
  writeJsonCache,
  type CacheFileSystem,
  type CacheFreshnessStatus,
} from "../../../shared/lib/cache.ts";

import type { SeaWaterQualitySummary } from "../domain/sea-water-quality.ts";

interface BudvaSeaWaterQualityCacheSnapshot {
  fetchedAt: string;
  lastRefreshError?: string;
  lastSuccessfulRefreshAt: string;
  parserWarnings: string[];
  schemaVersion: 1;
  source: "Javno preduzeće za upravljanje morskim dobrom Crne Gore";
  sourceUrl: string;
  summary: SeaWaterQualitySummary;
}

interface BudvaSeaWaterQualityCacheResult {
  lastSuccessfulRefreshAt?: string;
  state: CacheFreshnessStatus;
  summary?: SeaWaterQualitySummary;
}

const defaultBudvaSeaWaterQualityCachePath = env.SEA_WATER_QUALITY_CACHE_PATH;

function calculateBudvaSeaWaterQualityFreshness(
  fetchedAt: Date | undefined,
  now = new Date(),
  maxAgeMinutes = env.SEA_WATER_QUALITY_CACHE_FRESHNESS_MINUTES,
): CacheFreshnessStatus {
  return calculateCacheFreshness(fetchedAt, now, maxAgeMinutes);
}

async function readBudvaSeaWaterQualityCache(
  cachePath = defaultBudvaSeaWaterQualityCachePath,
  fileSystem: CacheFileSystem = nodeFileSystem,
): Promise<BudvaSeaWaterQualityCacheSnapshot | null> {
  const snapshot = await readJsonCache<BudvaSeaWaterQualityCacheSnapshot>(cachePath, fileSystem);
  return isValidSnapshot(snapshot) ? snapshot : null;
}

async function writeBudvaSeaWaterQualityCache(
  snapshot: BudvaSeaWaterQualityCacheSnapshot,
  cachePath = defaultBudvaSeaWaterQualityCachePath,
  fileSystem: CacheFileSystem = nodeFileSystem,
) {
  await writeJsonCache(snapshot, cachePath, fileSystem);
}

async function getCachedBudvaSeaWaterQuality(
  cachePath = defaultBudvaSeaWaterQualityCachePath,
  now = new Date(),
): Promise<BudvaSeaWaterQualityCacheResult> {
  const snapshot = await readBudvaSeaWaterQualityCache(cachePath);
  if (!snapshot) return { state: "unavailable" };

  return {
    lastSuccessfulRefreshAt: snapshot.lastSuccessfulRefreshAt,
    state: calculateBudvaSeaWaterQualityFreshness(new Date(snapshot.fetchedAt), now),
    summary: snapshot.summary,
  };
}

function isValidSnapshot(value: unknown): value is BudvaSeaWaterQualityCacheSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<BudvaSeaWaterQualityCacheSnapshot>;
  return (
    typeof candidate.fetchedAt === "string" &&
    typeof candidate.lastSuccessfulRefreshAt === "string" &&
    candidate.schemaVersion === 1 &&
    typeof candidate.summary === "object" &&
    candidate.summary !== null
  );
}

export {
  calculateBudvaSeaWaterQualityFreshness,
  defaultBudvaSeaWaterQualityCachePath,
  getCachedBudvaSeaWaterQuality,
  readBudvaSeaWaterQualityCache,
  writeBudvaSeaWaterQualityCache,
  type BudvaSeaWaterQualityCacheResult,
  type BudvaSeaWaterQualityCacheSnapshot,
};
