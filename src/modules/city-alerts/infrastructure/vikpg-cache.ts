import type { CityAlert } from "@/modules/city-alerts/domain/city-alert";
import { deserializeCityAlerts } from "./city-alert-cache-deserialization.ts";
import { env } from "../../../config/env.ts";
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

const defaultVikpgCachePath = env.VIKPG_CACHE_PATH;

function calculateVikpgFreshness(
  fetchedAt: Date | undefined,
  now = new Date(),
  maxAgeMinutes = 90,
): VikpgFreshnessStatus {
  return calculateCacheFreshness(fetchedAt, now, maxAgeMinutes);
}

async function readVikpgCacheResult(
  cachePath = env.VIKPG_CACHE_PATH,
  fileSystem: CacheFileSystem = nodeFileSystem,
): Promise<VikpgCacheReadResult> {
  try {
    const parsed = JSON.parse(await fileSystem.readFile(cachePath, "utf8")) as unknown;
    const snapshot = deserializeVikpgCacheSnapshot(parsed);
    if (!snapshot) {
      return {
        error: new VikpgCacheError("cache-invalid-json", "VIK cache contains invalid data."),
        snapshot: null,
      };
    }
    return {
      snapshot,
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

function deserializeVikpgCacheSnapshot(value: unknown): VikpgCacheSnapshot | undefined {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.source !== "Vodovod i kanalizacija Podgorica"
  ) {
    return undefined;
  }

  const alerts = deserializeCityAlerts(value.alerts);
  if (
    !alerts ||
    !isString(value.fetchedAt) ||
    !isFreshnessStatus(value.freshnessStatus) ||
    !isString(value.lastSuccessfulRefreshAt) ||
    !isStringArray(value.parserWarnings) ||
    !isString(value.sourceUrl) ||
    !isOptionalString(value.lastRefreshError)
  ) {
    return undefined;
  }

  return {
    alerts: alerts.map(cleanLegacyVikpgAlert),
    fetchedAt: value.fetchedAt,
    freshnessStatus: value.freshnessStatus,
    ...(value.lastRefreshError ? { lastRefreshError: value.lastRefreshError } : {}),
    lastSuccessfulRefreshAt: value.lastSuccessfulRefreshAt,
    parserWarnings: value.parserWarnings,
    schemaVersion: 1,
    source: "Vodovod i kanalizacija Podgorica",
    sourceUrl: value.sourceUrl,
  };
}

function cleanLegacyVikpgAlert(alert: CityAlert): CityAlert {
  return {
    ...alert,
    description:
      alert.description.kind === "source"
        ? { kind: "source", value: removeVikpgPageMetadata(alert.description.value) }
        : alert.description,
    ...(alert.rawSourceText ? { rawSourceText: removeVikpgPageMetadata(alert.rawSourceText) } : {}),
  };
}

function removeVikpgPageMetadata(value: string) {
  return value
    .replace(/\bLeave a comment\b/gi, "")
    .replace(/\bLeave review\b/gi, "")
    .replace(/\b\d+\s+(?:Views?|Likes?)\b/gi, "")
    .replace(/\b(?:Share|Social metadata)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function readVikpgCache(
  cachePath = env.VIKPG_CACHE_PATH,
  fileSystem: CacheFileSystem = nodeFileSystem,
) {
  return (await readVikpgCacheResult(cachePath, fileSystem)).snapshot;
}

async function writeVikpgCache(
  snapshot: VikpgCacheSnapshot,
  cachePath = env.VIKPG_CACHE_PATH,
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

function isFreshnessStatus(value: unknown): value is VikpgFreshnessStatus {
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
