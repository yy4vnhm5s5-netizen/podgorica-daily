import assert from "node:assert/strict";
import test from "node:test";

import { getParkingAvailabilityLabel } from "./parking-ui-model.ts";

const location = {
  capacity: 320,
  name: "Parking br. 1 – Kasarna Morača",
  sourceId: "broj1",
  type: "parking" as const,
};

test("renders a free-space count only for an individually fresh parking record", () => {
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
    },
    "me",
    new Date("2026-08-11T10:00:00.000Z"),
  );

  assert.deepEqual(fresh, {
    freeSpaces: 12,
    state: "fresh",
    updatedLabel: "Ažurirano prije 5 minuta",
  });
  assert.deepEqual(stale, { state: "unavailable" });
});
