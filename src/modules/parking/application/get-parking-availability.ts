import type { ParkingAvailabilityReadModel } from "../domain/parking-availability.ts";
import {
  getParkingLocationAvailabilityState,
  readParkingCacheResult,
} from "../infrastructure/parking-cache.ts";
import { parkingCatalogue } from "../infrastructure/parking-servis-podgorica.ts";

async function getParkingAvailability({
  now = new Date(),
  readCache = readParkingCacheResult,
}: {
  now?: Date;
  readCache?: typeof readParkingCacheResult;
} = {}): Promise<ParkingAvailabilityReadModel> {
  const cached = await readCache(undefined, now);
  const availabilityBySourceId = new Map(
    cached.snapshot?.locations.map((location) => [location.sourceId, location]) ?? [],
  );

  return {
    ...(cached.snapshot?.fetchedAt ? { fetchedAt: cached.snapshot.fetchedAt } : {}),
    ...(cached.snapshot?.lastSuccessfulRefreshAt
      ? { lastSuccessfulRefreshAt: cached.snapshot.lastSuccessfulRefreshAt }
      : {}),
    locations: parkingCatalogue.map((catalogueLocation) => {
      const availability = availabilityBySourceId.get(catalogueLocation.sourceId);
      const availabilityState = getParkingLocationAvailabilityState(
        availability?.sourceUpdatedAt,
        now,
      );
      return {
        ...catalogueLocation,
        availabilityState,
        ...(availabilityState === "fresh" && availability
          ? {
              freeSpaces: availability.freeSpaces,
              sourceUpdatedAt: availability.sourceUpdatedAt,
            }
          : {}),
      };
    }),
    state: cached.state,
  };
}

export { getParkingAvailability };
