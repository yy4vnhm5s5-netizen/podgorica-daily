import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { CityAlert } from "@/modules/city-alerts/domain/city-alert";

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

interface CacheFileSystem {
  mkdir(path: string, options: { recursive: true }): Promise<void>;
  readFile(path: string, encoding: "utf8"): Promise<string>;
  rename(from: string, to: string): Promise<void>;
  rm(path: string, options: { force: true }): Promise<void>;
  writeFile(path: string, contents: string, encoding: "utf8"): Promise<void>;
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

const defaultCachePath = ".runtime/cache/cedis-planned-outages.json";
const nodeFileSystem: CacheFileSystem = {
  mkdir: async (path, options) => {
    await mkdir(path, options);
  },
  readFile,
  rename,
  rm,
  writeFile,
};

function calculateFreshness(
  fetchedAt: Date | undefined,
  now = new Date(),
  maxAgeMinutes = 90,
): FreshnessStatus {
  if (!fetchedAt || Number.isNaN(fetchedAt.getTime())) return "unavailable";
  return now.getTime() - fetchedAt.getTime() <= maxAgeMinutes * 60_000 ? "fresh" : "stale";
}

async function readCedisCacheResult(
  cachePath = process.env.CEDIS_CACHE_PATH ?? defaultCachePath,
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
  cachePath = process.env.CEDIS_CACHE_PATH ?? defaultCachePath,
  fileSystem: CacheFileSystem = nodeFileSystem,
) {
  return (await readCedisCacheResult(cachePath, fileSystem)).snapshot;
}

async function writeCedisCache(
  snapshot: CedisCacheSnapshot,
  cachePath = process.env.CEDIS_CACHE_PATH ?? defaultCachePath,
  fileSystem: CacheFileSystem = nodeFileSystem,
) {
  const temporaryPath = `${cachePath}.tmp`;
  try {
    await fileSystem.mkdir(dirname(cachePath), { recursive: true });
    await fileSystem.writeFile(temporaryPath, JSON.stringify(snapshot), "utf8");
    await fileSystem.rename(temporaryPath, cachePath);
  } catch {
    await fileSystem.rm(temporaryPath, { force: true }).catch(() => undefined);
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
