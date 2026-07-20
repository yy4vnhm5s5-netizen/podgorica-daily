import { ensureCacheDirectory, readJsonCache } from "../../../shared/lib/cache.ts";

import {
  runZpcgRailwayCollector,
  type ZpcgCollectorResult,
} from "./collect-zpcg-railway.ts";
import type { ZpcgRailwayCacheSnapshot } from "./zpcg-railway.ts";

interface InitializeZpcgRailwayCacheDependencies {
  cachePath: string;
  ensureDirectory?: (cachePath: string) => Promise<void>;
  log?: (message: string) => void;
  readCache?: (cachePath: string) => Promise<ZpcgRailwayCacheSnapshot | null>;
  refresh?: () => Promise<ZpcgCollectorResult>;
}

async function initializeZpcgRailwayCache({
  cachePath,
  ensureDirectory = ensureCacheDirectory,
  log = console.info,
  readCache = (path) => readJsonCache<ZpcgRailwayCacheSnapshot>(path),
  refresh = () => runZpcgRailwayCollector({ cachePath }),
}: InitializeZpcgRailwayCacheDependencies): Promise<"cache-found" | "failed" | "refreshed"> {
  try {
    await ensureDirectory(cachePath);
    const snapshot = await readCache(cachePath);

    if (isUsableSnapshot(snapshot)) {
      log(`ŽPCG: cache found at ${cachePath}.`);
      return "cache-found";
    }

    log(`ŽPCG: cache unavailable at ${cachePath}; refresh started.`);
    const result = await refresh();

    if (result.state === "already-running") {
      log("ŽPCG: refresh already running.");
      return "failed";
    }

    if (result.refresh?.success) {
      log(`ŽPCG: refresh completed successfully with ${result.refresh.acceptedDepartures} departure(s).`);
      return "refreshed";
    }

    log(`ŽPCG: refresh failed (${result.refresh?.errorCode ?? "zpcg-refresh-failed"}).`);
    return "failed";
  } catch (error) {
    log(`ŽPCG: initialization failed (${getErrorMessage(error)}).`);
    return "failed";
  }
}

function isUsableSnapshot(snapshot: ZpcgRailwayCacheSnapshot | null): boolean {
  return Boolean(
    snapshot &&
      Array.isArray(snapshot.departures) &&
      typeof snapshot.lastSuccessfulRefreshAt === "string" &&
      !Number.isNaN(Date.parse(snapshot.lastSuccessfulRefreshAt)) &&
      typeof snapshot.timetableDate === "string",
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

export {
  initializeZpcgRailwayCache,
  type InitializeZpcgRailwayCacheDependencies,
};
