import type { CityAlert } from "@/modules/city-alerts/domain/city-alert";
import { resolveRuntimeCachePath } from "../../../config/runtime-data.ts";
import {
  calculateCacheFreshness,
  nodeFileSystem,
  writeJsonCache,
  type CacheFileSystem,
} from "../../../shared/lib/cache.ts";

type VikpgFreshnessStatus = "fresh" | "stale" | "unavailable";

interface VikpgCacheSnapshot {
  alerts: CityAlert[];
  fetchedAt: string;
  freshnessStatus: VikpgFreshnessStatus;
  lastRefreshError?: string;
  lastSuccessfulRefreshAt: string;
  parserWarnings: string[];
  schemaVersion: 1;
  source: "Vodovod i kanalizacija Podgorica";
  sourceUrl: string;
}

class VikpgCacheError extends Error {
  readonly code: "cache-invalid-json" | "cache-read-failed" | "cache-write-failed";

  constructor(
    code: "cache-invalid-json" | "cache-read-failed" | "cache-write-failed",
    message: string,
  ) {
    super(message);
    this.name = "VikpgCacheError";
    this.code = code;
  }
}

interface VikpgCacheReadResult {
  error?: VikpgCacheError;
  snapshot: VikpgCacheSnapshot | null;
}

const defaultVikpgCachePath = resolveRuntimeCachePath("vikpg-water-alerts.json");

function calculateVikpgFreshness(
  fetchedAt: Date | undefined,
  now = new Date(),
  maxAgeMinutes = 90,
): VikpgFreshnessStatus {
  return calculateCacheFreshness(fetchedAt, now, maxAgeMinutes);
}

async function readVikpgCacheResult(
  cachePath = process.env.VIKPG_CACHE_PATH ?? resolveRuntimeCachePath("vikpg-water-alerts.json"),
  fileSystem: CacheFileSystem = nodeFileSystem,
): Promise<VikpgCacheReadResult> {
  try {
    return {
      snapshot: JSON.parse(await fileSystem.readFile(cachePath, "utf8")) as VikpgCacheSnapshot,
    };
  } catch (error) {
    if (isMissingFileError(error)) return { snapshot: null };
    if (error instanceof SyntaxError) {
      return {
        error: new VikpgCacheError("cache-invalid-json", "VIK cache contains invalid JSON."),
        snapshot: null,
      };
    }
    return {
      error: new VikpgCacheError("cache-read-failed", "VIK cache could not be read."),
      snapshot: null,
    };
  }
}

async function readVikpgCache(
  cachePath = process.env.VIKPG_CACHE_PATH ?? resolveRuntimeCachePath("vikpg-water-alerts.json"),
  fileSystem: CacheFileSystem = nodeFileSystem,
) {
  return (await readVikpgCacheResult(cachePath, fileSystem)).snapshot;
}

async function writeVikpgCache(
  snapshot: VikpgCacheSnapshot,
  cachePath = process.env.VIKPG_CACHE_PATH ?? resolveRuntimeCachePath("vikpg-water-alerts.json"),
  fileSystem: CacheFileSystem = nodeFileSystem,
) {
  try {
    await writeJsonCache(snapshot, cachePath, fileSystem);
  } catch {
    throw new VikpgCacheError("cache-write-failed", "VIK cache could not be updated.");
  }
}

function isMissingFileError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export {
  calculateVikpgFreshness,
  defaultVikpgCachePath,
  readVikpgCache,
  readVikpgCacheResult,
  writeVikpgCache,
  VikpgCacheError,
  type CacheFileSystem,
  type VikpgCacheReadResult,
  type VikpgCacheSnapshot,
  type VikpgFreshnessStatus,
};
