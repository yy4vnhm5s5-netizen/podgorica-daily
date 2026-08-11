import type { ParkingAvailabilitySnapshot } from "../domain/parking-availability.ts";
import {
  createParkingServisHttpClient,
  parkingAvailabilitySourceUrl,
  parkingCityId,
  parkingProviderId,
  parseParkingAvailabilityResponse,
  ParkingServisSourceError,
  type ParkingServisHttpClient,
} from "./parking-servis-podgorica.ts";
import { defaultParkingCachePath, readParkingCache, writeParkingCache } from "./parking-cache.ts";

interface ParkingRefreshResult {
  acceptedLocations: number;
  errorCode?: string;
  retainedPreviousSnapshot: boolean;
  snapshot: ParkingAvailabilitySnapshot | null;
  success: boolean;
  warnings: readonly string[];
}

async function refreshParkingAvailability({
  cachePath = defaultParkingCachePath,
  httpClient = createParkingServisHttpClient(),
  now = () => new Date(),
}: {
  cachePath?: string;
  httpClient?: ParkingServisHttpClient;
  now?: () => Date;
} = {}): Promise<ParkingRefreshResult> {
  const previous = await readParkingCache(cachePath);

  try {
    const response = await httpClient.get();
    const refreshTime = now();
    const parsed = parseParkingAvailabilityResponse(response.body, { now: refreshTime });
    const timestamp = refreshTime.toISOString();
    const snapshot: ParkingAvailabilitySnapshot = {
      cityId: parkingCityId,
      fetchedAt: timestamp,
      lastSuccessfulRefreshAt: timestamp,
      locations: parsed.locations,
      provider: parkingProviderId,
      schemaVersion: 1,
      sourceUrl: parkingAvailabilitySourceUrl,
    };

    try {
      await writeParkingCache(snapshot, cachePath);
    } catch {
      return retainPrevious(previous, "parking-cache-write-failed", parsed.warnings);
    }

    return {
      acceptedLocations: snapshot.locations.length,
      retainedPreviousSnapshot: false,
      snapshot,
      success: true,
      warnings: parsed.warnings,
    };
  } catch (error) {
    return retainPrevious(
      previous,
      error instanceof ParkingServisSourceError ? error.code : "parking-refresh-failed",
    );
  }
}

function retainPrevious(
  previous: ParkingAvailabilitySnapshot | null,
  errorCode: string,
  warnings: readonly string[] = [],
): ParkingRefreshResult {
  return {
    acceptedLocations: 0,
    errorCode,
    retainedPreviousSnapshot: previous !== null,
    snapshot: previous ? { ...previous, lastRefreshError: errorCode } : null,
    success: false,
    warnings,
  };
}

export { refreshParkingAvailability, type ParkingRefreshResult };
