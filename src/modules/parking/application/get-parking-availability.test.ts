import assert from "node:assert/strict";
import test from "node:test";

import { getParkingAvailability } from "./get-parking-availability.ts";

test("shows fresh and stale Parking servis records independently while keeping missing locations useful", async () => {
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
  assert.equal(missing?.availabilityState, "unavailable");
  assert.equal(missing?.capacity, 84);
});
