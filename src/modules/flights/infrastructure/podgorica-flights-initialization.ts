import { ensureCacheDirectory, readJsonCache } from "../../../shared/lib/cache.ts";

import {
  runPodgoricaFlightsCollector,
  type PodgoricaFlightsCollectorResult,
} from "./collect-podgorica-flights.ts";
import type { FlightsSupportedCityId, PodgoricaFlightsCacheSnapshot } from "./podgorica-flights.ts";

interface InitializePodgoricaFlightsDependencies {
  cachePath: string;
  cityId?: FlightsSupportedCityId;
  ensureDirectory?: (cachePath: string) => Promise<void>;
  log?: (message: string) => void;
  readCache?: (cachePath: string) => Promise<PodgoricaFlightsCacheSnapshot | null>;
  refresh?: () => Promise<PodgoricaFlightsCollectorResult>;
}

async function initializePodgoricaFlights({
  cachePath,
  cityId = "podgorica",
  ensureDirectory = ensureCacheDirectory,
  log = console.info,
  readCache = (path) => readJsonCache<PodgoricaFlightsCacheSnapshot>(path),
  refresh = () => runPodgoricaFlightsCollector({ cachePath, cityId }),
}: InitializePodgoricaFlightsDependencies): Promise<"cache-found" | "failed" | "refreshed"> {
  try {
    await ensureDirectory(cachePath);
    const snapshot = await readCache(cachePath);
    if (snapshot && Array.isArray(snapshot.flights) && snapshot.lastSuccessfulRefreshAt) {
      log(`Airport flights (${cityId}): cache found at ${cachePath}.`);
      return "cache-found";
    }

    log(`Airport flights (${cityId}): cache unavailable at ${cachePath}; refresh started.`);
    const result = await refresh();
    if (result.refresh?.success) {
      log(
        `Airport flights (${cityId}): refresh completed with ${result.refresh.acceptedFlights} flight(s).`,
      );
      return "refreshed";
    }
    log(
      `Airport flights (${cityId}): refresh failed (${result.refresh?.errorCode ?? "flights-refresh-failed"}).`,
    );
    return "failed";
  } catch (error) {
    log(
      `Airport flights (${cityId}): initialization failed (${error instanceof Error ? error.message : "unknown error"}).`,
    );
    return "failed";
  }
}

export { initializePodgoricaFlights, type InitializePodgoricaFlightsDependencies };
