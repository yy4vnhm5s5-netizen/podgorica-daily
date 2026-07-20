import type { CityAlert } from "@/modules/city-alerts/domain/city-alert";
import { env } from "../../../config/env.ts";
import {
  calculateCacheFreshness,
  nodeFileSystem,
  writeJsonCache,
  type CacheFileSystem,
} from "../../../shared/lib/cache.ts";

type FreshnessStatus = "fresh" | "stale" | "unavailable";

interface CedisCacheSnapshot {
  alerts: CityAlert[];
  fetchedAt: string;
  freshnessStatus: FreshnessStatus;
  lastRefreshError?: string;
  lastSuccessfulRefreshAt: string;
  parserWarnings: string[];
  schemaVersion: 1;
  source: "CEDIS";
  sourceUpdatedAt?: string;
  sourceUrl: string;
}

class CedisCacheError extends Error {
  readonly code: "cache-read-failed" | "cache-write-failed" | "cache-invalid-json";

  constructor(
    code: "cache-read-failed" | "cache-write-failed" | "cache-invalid-json",
    message: string,
  ) {
    super(message);
    this.name = "CedisCacheError";
    this.code = code;
  }
}

interface CacheReadResult {
  error?: CedisCacheError;
  snapshot: CedisCacheSnapshot | null;
}

const defaultCachePath = env.CEDIS_CACHE_PATH;
function calculateFreshness(
  fetchedAt: Date | undefined,
  now = new Date(),
  maxAgeMinutes = 90,
): FreshnessStatus {
  return calculateCacheFreshness(fetchedAt, now, maxAgeMinutes);
}

async function readCedisCacheResult(
  cachePath = env.CEDIS_CACHE_PATH,
  fileSystem: CacheFileSystem = nodeFileSystem,
): Promise<CacheReadResult> {
  try {
    return {
      snapshot: JSON.parse(await fileSystem.readFile(cachePath, "utf8")) as CedisCacheSnapshot,
    };
  } catch (error) {
    if (isMissingFileError(error)) return { snapshot: null };
    if (error instanceof SyntaxError) {
      return {
        error: new CedisCacheError("cache-invalid-json", "CEDIS cache contains invalid JSON."),
        snapshot: null,
      };
    }
    return {
      error: new CedisCacheError("cache-read-failed", "CEDIS cache could not be read."),
      snapshot: null,
    };
  }
}

async function readCedisCache(
  cachePath = env.CEDIS_CACHE_PATH,
  fileSystem: CacheFileSystem = nodeFileSystem,
) {
  return (await readCedisCacheResult(cachePath, fileSystem)).snapshot;
}

async function writeCedisCache(
  snapshot: CedisCacheSnapshot,
  cachePath = env.CEDIS_CACHE_PATH,
  fileSystem: CacheFileSystem = nodeFileSystem,
) {
  try {
    await writeJsonCache(snapshot, cachePath, fileSystem);
  } catch {
    throw new CedisCacheError("cache-write-failed", "CEDIS cache could not be updated.");
  }
}

function isMissingFileError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export {
  calculateFreshness,
  defaultCachePath,
  readCedisCache,
  readCedisCacheResult,
  writeCedisCache,
  CedisCacheError,
  type CacheFileSystem,
  type CacheReadResult,
  type CedisCacheSnapshot,
  type FreshnessStatus,
};
