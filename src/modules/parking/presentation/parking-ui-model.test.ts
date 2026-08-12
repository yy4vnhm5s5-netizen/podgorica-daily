import assert from "node:assert/strict";
import test from "node:test";

import { getParkingAvailabilityLabel } from "./parking-ui-model.ts";

const location = {
  capacity: 320,
  name: "Parking br. 1 – Kasarna Morača",
  sourceId: "broj1",
  type: "parking" as const,
};

test("renders a current free-space count only for an individually fresh parking record", () => {
  const fresh = getParkingAvailabilityLabel(
    {
      ...location,
      availabilityState: "fresh",
      freeSpaces: 12,
      sourceUpdatedAt: "2026-08-11T09:55:00.000Z",
    },
    "me",
    new Date("2026-08-11T10:00:00.000Z"),
  );
  const stale = getParkingAvailabilityLabel(
    {
      ...location,
      availabilityState: "stale",
      freeSpaces: 12,
      sourceUpdatedAt: "2026-08-01T08:00:00.000Z",
    },
    "me",
    new Date("2026-08-11T10:00:00.000Z"),
  );

  assert.deepEqual(fresh, {
    freeSpaces: 12,
    state: "fresh",
    updatedLabel: "Ažurirano prije 5 minuta",
  });
  assert.deepEqual(stale, {
    lastReportedLabel: "Posljednje prijavljeno: 12 slobodnih mjesta",
    sourceLabel: "Izvorni podatak: 1. avgust 2026.",
    state: "stale",
  });
  assert.doesNotMatch(stale.lastReportedLabel, /Ažurirano|Trenutno|Sada|Live/u);
});

test("keeps missing or invalid availability out of the public presentation", () => {
  const missing = getParkingAvailabilityLabel(
    {
      ...location,
      availabilityState: "unavailable",
    },
    "me",
  );
  const staleWithoutSourceData = getParkingAvailabilityLabel(
    {
      ...location,
      availabilityState: "stale",
    },
    "me",
  );

  assert.deepEqual(missing, { state: "unavailable" });
  assert.deepEqual(staleWithoutSourceData, { state: "unavailable" });
});
