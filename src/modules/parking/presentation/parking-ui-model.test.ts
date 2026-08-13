import assert from "node:assert/strict";
import test from "node:test";

import {
  getParkingAvailabilityLabel,
  getParkingDashboardSummary,
  getParkingSections,
} from "./parking-ui-model.ts";

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
  assert.deepEqual(stale, { state: "unavailable" });
});

test("keeps a fresh zero-free-spaces record publishable", () => {
  const zero = getParkingAvailabilityLabel(
    {
      ...location,
      availabilityState: "fresh",
      freeSpaces: 0,
      sourceUpdatedAt: "2026-08-11T09:55:00.000Z",
    },
    "me",
    new Date("2026-08-11T10:00:00.000Z"),
  );

  assert.deepEqual(zero, {
    freeSpaces: 0,
    state: "fresh",
    updatedLabel: "Ažurirano prije 5 minuta",
  });
});

test("keeps missing or invalid availability out of the public presentation", () => {
  const missing = getParkingAvailabilityLabel(
    {
      ...location,
      availabilityState: "unavailable",
    },
    "me",
  );
  const staleWithSourceData = getParkingAvailabilityLabel(
    {
      ...location,
      availabilityState: "stale",
      freeSpaces: 12,
      sourceUpdatedAt: "2026-08-01T08:00:00.000Z",
    },
    "me",
  );

  assert.deepEqual(missing, { state: "unavailable" });
  assert.deepEqual(staleWithSourceData, { state: "unavailable" });
});

test("creates sections only for publishable fresh locations", () => {
  const sections = getParkingSections([
    {
      ...location,
      availabilityState: "fresh",
      freeSpaces: 12,
      sourceUpdatedAt: "2026-08-11T09:55:00.000Z",
    },
    {
      capacity: 97,
      name: "Garaža br. 1 – Novaka Miloševa",
      sourceId: "garaza1",
      type: "garage",
      availabilityState: "fresh",
      freeSpaces: 0,
      sourceUpdatedAt: "2026-08-11T09:54:00.000Z",
    },
  ]);

  assert.deepEqual(
    sections.map(({ locations, type }) => ({
      sourceIds: locations.map(({ sourceId }) => sourceId),
      type,
    })),
    [
      { sourceIds: ["broj1"], type: "parking" },
      { sourceIds: ["garaza1"], type: "garage" },
    ],
  );
  assert.deepEqual(getParkingSections([]), []);
});

test("selects the three highest public Parking counts and preserves catalogue order for ties", () => {
  const summary = getParkingDashboardSummary([
    {
      ...location,
      availabilityState: "fresh",
      freeSpaces: 20,
      sourceUpdatedAt: "2026-08-11T09:55:00.000Z",
    },
    {
      ...location,
      name: "Parking br. 2 – Beko",
      sourceId: "broj2",
      availabilityState: "fresh",
      freeSpaces: 35,
      sourceUpdatedAt: "2026-08-11T09:55:00.000Z",
    },
    {
      ...location,
      name: "Parking br. 3 – Stadion zapad",
      sourceId: "broj3",
      availabilityState: "fresh",
      freeSpaces: 35,
      sourceUpdatedAt: "2026-08-11T09:55:00.000Z",
    },
    {
      ...location,
      name: "Parking br. 4",
      sourceId: "broj4",
      availabilityState: "fresh",
      freeSpaces: 0,
      sourceUpdatedAt: "2026-08-11T09:55:00.000Z",
    },
  ]);

  assert.deepEqual(
    summary.locations.map(({ sourceId }) => sourceId),
    ["broj2", "broj3", "broj1"],
  );
  assert.equal(summary.summaryLabel, "Aktuelni podaci za 4 lokacije");
});

test("keeps a fresh zero in the dashboard summary and returns no summary copy without fresh locations", () => {
  const zero = getParkingDashboardSummary([
    {
      ...location,
      availabilityState: "fresh",
      freeSpaces: 0,
      sourceUpdatedAt: "2026-08-11T09:55:00.000Z",
    },
  ]);

  assert.equal(zero.locations[0]?.freeSpaces, 0);
  assert.equal(zero.summaryLabel, "Aktuelni podaci za 1 lokaciju");
  assert.deepEqual(getParkingDashboardSummary([]), { locations: [] });
});
