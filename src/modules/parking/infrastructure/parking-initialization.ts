import {
  getActiveParkingContexts,
  runActiveParkingCollectors,
} from "./collect-parking-availability.ts";
import { readParkingCacheResult } from "./parking-cache.ts";

interface InitializeParkingAvailabilityDependencies {
  getContexts?: typeof getActiveParkingContexts;
  log?: (message: string) => void;
  readCache?: typeof readParkingCacheResult;
  refresh?: typeof runActiveParkingCollectors;
}

async function initializeParkingAvailability({
  getContexts = getActiveParkingContexts,
  log = console.info,
  readCache = readParkingCacheResult,
  refresh = runActiveParkingCollectors,
}: InitializeParkingAvailabilityDependencies = {}): Promise<
  "cache-found" | "failed" | "refreshed"
> {
  if (getContexts().length === 0) return "cache-found";
  const cached = await readCache();
  if (cached.state === "fresh") {
    log("Parking: fresh snapshot found.");
    return "cache-found";
  }

  log("Parking: snapshot unavailable; refresh started.");
  const results = await refresh();
  if (results.some(({ state }) => state === "success")) {
    log("Parking: refresh completed.");
    return "refreshed";
  }
  log("Parking: refresh failed.");
  return "failed";
}

export { initializeParkingAvailability, type InitializeParkingAvailabilityDependencies };
