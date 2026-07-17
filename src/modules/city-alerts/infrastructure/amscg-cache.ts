import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { RoadAlert } from "../domain/road-alert.ts";

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
  if (!fetchedAt || Number.isNaN(fetchedAt.getTime())) return "unavailable";
  return now.getTime() - fetchedAt.getTime() <= maxAgeMinutes * 60_000 ? "fresh" : "stale";
}

async function readAmscgCache(cachePath = process.env.AMSCG_CACHE_PATH ?? defaultAmscgCachePath) {
  try {
    return JSON.parse(await readFile(cachePath, "utf8")) as AmscgCacheSnapshot;
  } catch {
    return null;
  }
}

async function writeAmscgCache(
  snapshot: AmscgCacheSnapshot,
  cachePath = process.env.AMSCG_CACHE_PATH ?? defaultAmscgCachePath,
) {
  const temporaryPath = `${cachePath}.tmp`;
  try {
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(temporaryPath, JSON.stringify(snapshot), "utf8");
    await rename(temporaryPath, cachePath);
  } catch {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw new Error("AMSCG cache could not be updated.");
  }
}

export {
  calculateAmscgFreshness,
  defaultAmscgCachePath,
  readAmscgCache,
  writeAmscgCache,
  type AmscgCacheSnapshot,
  type AmscgFreshnessStatus,
};
