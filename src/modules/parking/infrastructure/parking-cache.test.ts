import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateParkingSnapshotState,
  getParkingLocationAvailabilityState,
  isValidParkingAvailabilitySnapshot,
} from "./parking-cache.ts";

test("uses the collector timestamp for each parking location, independently of other records", () => {
  const now = new Date("2026-08-11T10:00:00.000Z");

  assert.equal(getParkingLocationAvailabilityState("2026-08-11T09:50:00.000Z", now, 15), "fresh");
  assert.equal(getParkingLocationAvailabilityState("2026-08-11T09:44:59.000Z", now, 15), "stale");
  assert.equal(getParkingLocationAvailabilityState(undefined, now, 15), "unavailable");
  assert.equal(
    calculateParkingSnapshotState(new Date("2026-08-11T09:30:00.000Z"), now, 15, 60),
    "stale",
  );
});

test("does not accept a snapshot that contains an unknown location or a count above capacity", () => {
  const base = {
    cityId: "podgorica",
    fetchedAt: "2026-08-11T10:00:00.000Z",
    lastSuccessfulRefreshAt: "2026-08-11T10:00:00.000Z",
    provider: "parking-servis-podgorica",
    schemaVersion: 1,
    sourceUrl: "https://parkingservispg.me/wp-content/plugins/parking-mjesta/parking.php",
  };

  assert.equal(
    isValidParkingAvailabilitySnapshot({
      ...base,
      locations: [
        { freeSpaces: 321, sourceId: "broj1", sourceUpdatedAt: "2026-08-11T09:55:00.000Z" },
      ],
    }),
    false,
  );
  assert.equal(
    isValidParkingAvailabilitySnapshot({
      ...base,
      locations: [
        { freeSpaces: 1, sourceId: "unknown", sourceUpdatedAt: "2026-08-11T09:55:00.000Z" },
      ],
    }),
    false,
  );
});
