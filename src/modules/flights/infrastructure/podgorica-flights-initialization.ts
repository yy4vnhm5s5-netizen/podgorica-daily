import { ensureCacheDirectory, readJsonCache } from "../../../shared/lib/cache.ts";

import {
  runPodgoricaFlightsCollector,
  type PodgoricaFlightsCollectorResult,
} from "./collect-podgorica-flights.ts";
import type { PodgoricaFlightsCacheSnapshot } from "./podgorica-flights.ts";

interface InitializePodgoricaFlightsDependencies {
  cachePath: string;
  ensureDirectory?: (cachePath: string) => Promise<void>;
  log?: (message: string) => void;
  readCache?: (cachePath: string) => Promise<PodgoricaFlightsCacheSnapshot | null>;
  refresh?: () => Promise<PodgoricaFlightsCollectorResult>;
}

async function initializePodgoricaFlights({
  cachePath,
  ensureDirectory = ensureCacheDirectory,
  log = console.info,
  readCache = (path) => readJsonCache<PodgoricaFlightsCacheSnapshot>(path),
  refresh = () => runPodgoricaFlightsCollector({ cachePath }),
}: InitializePodgoricaFlightsDependencies): Promise<"cache-found" | "failed" | "refreshed"> {
  try {
    await ensureDirectory(cachePath);
    const snapshot = await readCache(cachePath);
    if (snapshot && Array.isArray(snapshot.flights) && snapshot.lastSuccessfulRefreshAt) {
      log(`Podgorica Airport: cache found at ${cachePath}.`);
      return "cache-found";
    }

    log(`Podgorica Airport: cache unavailable at ${cachePath}; refresh started.`);
    const result = await refresh();
    if (result.refresh?.success) {
      log(`Podgorica Airport: refresh completed with ${result.refresh.acceptedFlights} flight(s).`);
      return "refreshed";
    }
    log(
      `Podgorica Airport: refresh failed (${result.refresh?.errorCode ?? "flights-refresh-failed"}).`,
    );
    return "failed";
  } catch (error) {
    log(
      `Podgorica Airport: initialization failed (${error instanceof Error ? error.message : "unknown error"}).`,
    );
    return "failed";
  }
}

export { initializePodgoricaFlights, type InitializePodgoricaFlightsDependencies };
