import assert from "node:assert/strict";
import test from "node:test";

import type { ParkingCacheResult } from "../infrastructure/parking-cache.ts";
import { getParkingAvailability } from "./get-parking-availability.ts";

test("publishes only individually fresh validated locations and preserves a fresh zero", async () => {
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
          { freeSpaces: 0, sourceId: "broj2a", sourceUpdatedAt: "2026-08-11T09:50:00.000Z" },
          { freeSpaces: 36, sourceId: "garaza1", sourceUpdatedAt: "2026-08-11T09:51:00.000Z" },
        ],
        provider: "parking-servis-podgorica",
        schemaVersion: 1,
        sourceUrl: "https://parkingservispg.me/wp-content/plugins/parking-mjesta/parking.php",
      },
      state: "fresh",
    }),
  });

  const fresh = result.locations.find((location) => location.sourceId === "broj1");
  const zero = result.locations.find((location) => location.sourceId === "broj2a");
  const garage = result.locations.find((location) => location.sourceId === "garaza1");

  assert.deepEqual(fresh, {
    availabilityState: "fresh",
    capacity: 320,
    freeSpaces: 12,
    name: "Parking br. 1 – Kasarna Morača",
    sourceId: "broj1",
    sourceUpdatedAt: "2026-08-11T09:55:00.000Z",
    type: "parking",
  });
  assert.equal(zero?.availabilityState, "fresh");
  assert.equal(zero?.freeSpaces, 0);
  assert.equal(garage?.availabilityState, "fresh");
  assert.equal(garage?.type, "garage");
  assert.deepEqual(
    result.locations.map((location) => location.sourceId),
    ["broj1", "broj2a", "garaza1"],
  );
  assert.equal(
    result.locations.some(({ sourceId }) => sourceId === "broj2"),
    false,
  );
  assert.equal(
    result.locations.some(({ sourceId }) => sourceId === "broj3"),
    false,
  );
});

test("a location disappears when stale and automatically returns after a fresh source update", async () => {
  const now = new Date("2026-08-11T10:00:00.000Z");

  const stale = await getParkingAvailability({
    now,
    readCache: async () => createParkingCacheResult("2026-08-11T08:00:00.000Z"),
  });
  const fresh = await getParkingAvailability({
    now,
    readCache: async () => createParkingCacheResult("2026-08-11T09:55:00.000Z"),
  });

  const staleAgain = await getParkingAvailability({
    now,
    readCache: async () => createParkingCacheResult("2026-08-11T08:00:00.000Z"),
  });

  assert.deepEqual(stale.locations, []);
  assert.equal(fresh.locations.find(({ sourceId }) => sourceId === "broj1")?.freeSpaces, 12);
  assert.deepEqual(staleAgain.locations, []);
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

test("publishes no locations when the whole Parking snapshot is unavailable", async () => {
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

  assert.deepEqual(result.locations, []);
});
