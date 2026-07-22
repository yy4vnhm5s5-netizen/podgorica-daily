import { ensureCacheDirectory, readJsonCache } from "../../../shared/lib/cache.ts";

import {
  runMonteGigsGoingOutCollector,
  type GoingOutCollectorResult,
} from "./collect-montegigs-going-out.ts";
import type { GoingOutCacheSnapshot } from "./montegigs-going-out.ts";

interface InitializeGoingOutDependencies {
  cachePath: string;
  ensureDirectory?: (cachePath: string) => Promise<void>;
  log?: (message: string) => void;
  readCache?: (cachePath: string) => Promise<GoingOutCacheSnapshot | null>;
  refresh?: () => Promise<GoingOutCollectorResult>;
}

async function initializeMonteGigsGoingOut({
  cachePath,
  ensureDirectory = ensureCacheDirectory,
  log = console.info,
  readCache = (path) => readJsonCache<GoingOutCacheSnapshot>(path),
  refresh = () => runMonteGigsGoingOutCollector({ cachePath }),
}: InitializeGoingOutDependencies): Promise<"cache-found" | "failed" | "refreshed"> {
  try {
    await ensureDirectory(cachePath);
    const snapshot = await readCache(cachePath);
    if (snapshot?.lastSuccessfulRefreshAt && Array.isArray(snapshot.events)) {
      log(`MonteGigs: cache found at ${cachePath}.`);
      return "cache-found";
    }
    log(`MonteGigs: cache unavailable at ${cachePath}; refresh started.`);
    const result = await refresh();
    if (result.refresh?.success) {
      log(`MonteGigs: refresh completed with ${result.refresh.acceptedEvents} event(s).`);
      return "refreshed";
    }
    log(`MonteGigs: refresh failed (${result.refresh?.errorCode ?? "going-out-refresh-failed"}).`);
    return "failed";
  } catch (error) {
    log(
      `MonteGigs: initialization failed (${error instanceof Error ? error.message : "unknown error"}).`,
    );
    return "failed";
  }
}

export { initializeMonteGigsGoingOut, type InitializeGoingOutDependencies };
