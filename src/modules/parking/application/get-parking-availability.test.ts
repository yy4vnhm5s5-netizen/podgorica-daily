import assert from "node:assert/strict";
import test from "node:test";

import type { ParkingCacheResult } from "../infrastructure/parking-cache.ts";
import { getParkingAvailability } from "./get-parking-availability.ts";

test("shows only fresh Parking servis records while keeping stale and missing locations unavailable", async () => {
  const now = new Date("2026-08-11T10:00:00.000Z");
  const result = await getParkingAvailability({
    now,
    readCache: async () => ({
      snapshot: {
        cityId: "podgorica",
        fetchedAt: "2026-08-11T10:00:00.000Z",
        lastSuccessfulRefreshAt: "2026-08-11T10:00:00.000Z",
        locations: [
          { freeSpaces: 12, sourceId: "broj1", sourceUpdatedAt: "2026-08-11T09:55:00.000Z" },
          { freeSpaces: 13, sourceId: "broj2", sourceUpdatedAt: "2026-08-11T08:00:00.000Z" },
        ],
        provider: "parking-servis-podgorica",
        schemaVersion: 1,
        sourceUrl: "https://parkingservispg.me/wp-content/plugins/parking-mjesta/parking.php",
      },
      state: "fresh",
    }),
  });

  const fresh = result.locations.find((location) => location.sourceId === "broj1");
  const stale = result.locations.find((location) => location.sourceId === "broj2");
  const missing = result.locations.find((location) => location.sourceId === "broj3");

  assert.deepEqual(fresh, {
    availabilityState: "fresh",
    capacity: 320,
    freeSpaces: 12,
    name: "Parking br. 1 – Kasarna Morača",
    sourceId: "broj1",
    sourceUpdatedAt: "2026-08-11T09:55:00.000Z",
    type: "parking",
  });
  assert.equal(stale?.availabilityState, "stale");
  assert.equal(stale?.freeSpaces, undefined);
  assert.equal(stale?.sourceUpdatedAt, undefined);
  assert.equal(missing?.availabilityState, "unavailable");
  assert.equal(missing?.capacity, 84);
});

test("shows a previously stale location after a later source update becomes fresh", async () => {
  const now = new Date("2026-08-11T10:00:00.000Z");

  const stale = await getParkingAvailability({
    now,
    readCache: async () => createParkingCacheResult("2026-08-11T08:00:00.000Z"),
  });
  const fresh = await getParkingAvailability({
    now,
    readCache: async () => createParkingCacheResult("2026-08-11T09:55:00.000Z"),
  });

  assert.equal(stale.locations.find(({ sourceId }) => sourceId === "broj1")?.freeSpaces, undefined);
  assert.equal(fresh.locations.find(({ sourceId }) => sourceId === "broj1")?.freeSpaces, 12);
});

function createParkingCacheResult(sourceUpdatedAt: string): ParkingCacheResult {
  return {
    snapshot: {
      cityId: "podgorica" as const,
      fetchedAt: "2026-08-11T10:00:00.000Z",
      lastSuccessfulRefreshAt: "2026-08-11T10:00:00.000Z",
      locations: [{ freeSpaces: 12, sourceId: "broj1", sourceUpdatedAt }],
      provider: "parking-servis-podgorica" as const,
      schemaVersion: 1 as const,
      sourceUrl: "https://parkingservispg.me/wp-content/plugins/parking-mjesta/parking.php",
    },
    state: "fresh" as const,
  };
}

test("suppresses all location counts when the whole Parking snapshot is unavailable", async () => {
  const result = await getParkingAvailability({
    now: new Date("2026-08-11T10:00:00.000Z"),
    readCache: async () => ({
      snapshot: {
        cityId: "podgorica",
        fetchedAt: "2026-08-11T08:00:00.000Z",
        lastSuccessfulRefreshAt: "2026-08-11T08:00:00.000Z",
        locations: [
          { freeSpaces: 12, sourceId: "broj1", sourceUpdatedAt: "2026-08-11T07:55:00.000Z" },
        ],
        provider: "parking-servis-podgorica",
        schemaVersion: 1,
        sourceUrl: "https://parkingservispg.me/wp-content/plugins/parking-mjesta/parking.php",
      },
      state: "unavailable",
    }),
  });

  const location = result.locations.find(({ sourceId }) => sourceId === "broj1");
  assert.equal(location?.availabilityState, "unavailable");
  assert.equal(location?.freeSpaces, undefined);
  assert.equal(location?.sourceUpdatedAt, undefined);
});
