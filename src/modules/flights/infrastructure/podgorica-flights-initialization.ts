import { ensureCacheDirectory, readJsonCache } from "../../../shared/lib/cache.ts";

import {
  runAirportFlightsCollector,
  type AirportFlightsCollectorResult,
} from "./collect-podgorica-flights.ts";
import type { FlightsSupportedCityId, AirportFlightsCacheSnapshot } from "./podgorica-flights.ts";

interface InitializeAirportFlightsDependencies {
  cachePath: string;
  cityId?: FlightsSupportedCityId;
  ensureDirectory?: (cachePath: string) => Promise<void>;
  log?: (message: string) => void;
  readCache?: (cachePath: string) => Promise<AirportFlightsCacheSnapshot | null>;
  refresh?: () => Promise<AirportFlightsCollectorResult>;
}

async function initializeAirportFlights({
  cachePath,
  cityId = "podgorica",
  ensureDirectory = ensureCacheDirectory,
  log = console.info,
  readCache = (path) => readJsonCache<AirportFlightsCacheSnapshot>(path),
  refresh = () => runAirportFlightsCollector({ cachePath, cityId }),
}: InitializeAirportFlightsDependencies): Promise<"cache-found" | "failed" | "refreshed"> {
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

export { initializeAirportFlights, type InitializeAirportFlightsDependencies };
