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
    locations: parkingCatalogue.flatMap((catalogueLocation) => {
      const availability = availabilityBySourceId.get(catalogueLocation.sourceId);
      const availabilityState =
        cached.state === "unavailable"
          ? "unavailable"
          : getParkingLocationAvailabilityState(availability?.sourceUpdatedAt, now);

      // The source's per-location timestamp, not the snapshot timestamp, determines whether a
      // count is useful to visitors. Keep stale/missing records in the persisted snapshot and
      // catalogue for future validation and refreshes, but do not expose a capacity-only card
      // through this public read model.
      if (availabilityState !== "fresh" || !availability) return [];

      return [
        {
          ...catalogueLocation,
          availabilityState,
          freeSpaces: availability.freeSpaces,
          sourceUpdatedAt: availability.sourceUpdatedAt,
        },
      ];
    }),
    state: cached.state,
  };
}

export { getParkingAvailability };
