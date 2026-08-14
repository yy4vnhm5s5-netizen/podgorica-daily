import assert from "node:assert/strict";
import test from "node:test";

import {
  createCedisSourceHealthEntry,
  createFlightsSourceHealthEntry,
  createFuelSourceHealthEntry,
  createParkingSourceHealthEntry,
  getSourceHealth,
} from "./source-health.ts";
import { getCity } from "@/shared/config/cities";

test("keeps Fuel's source-backed semantic stale state when a technical snapshot has calculations", () => {
  const entry = createFuelSourceHealthEntry({
    calculations: [
      {
        effectiveDate: "2026-08-04",
        nextCalculationDate: "2026-08-10",
        prices: [],
        publishedAt: "2026-08-03T18:00:00.000Z",
        sourceName: "Ministarstvo energetike i rudarstva",
        sourceUrl: "https://www.gov.me/clanak/nove-cijene-goriva-20260804",
      },
    ],
    freshnessStatus: "stale",
    lastSuccessfulUpdate: new Date("2026-08-12T09:00:00.000Z"),
  });

  assert.equal(entry.snapshotState, "stale");
  assert.equal(entry.publicState, "stale");
  assert.equal(entry.storedRecordCount, 1);
  assert.equal(entry.effectiveDate, "2026-08-04");
  assert.equal(entry.nextCalculationDate, "2026-08-10");
});

test("distinguishes a stored Parking snapshot from locations that are currently public-displayable", () => {
  const entry = createParkingSourceHealthEntry({
    cached: {
      snapshot: {
        cityId: "podgorica",
        fetchedAt: "2026-08-12T09:00:00.000Z",
        lastSuccessfulRefreshAt: "2026-08-12T09:00:00.000Z",
        locations: [
          {
            freeSpaces: 20,
            sourceId: "1",
            sourceUpdatedAt: "2026-08-01T09:00:00.000Z",
          },
        ],
        provider: "parking-servis-podgorica",
        schemaVersion: 1,
        sourceUrl: "https://parkingservispg.me/wp-content/plugins/parking-mjesta/parking.php",
      },
      state: "fresh",
    },
    publicResult: {
      fetchedAt: "2026-08-12T09:00:00.000Z",
      lastSuccessfulRefreshAt: "2026-08-12T09:00:00.000Z",
      locations: [],
      state: "fresh",
    },
  });

  assert.equal(entry.snapshotState, "fresh");
  assert.equal(entry.publicState, "empty");
  assert.equal(entry.storedRecordCount, 1);
  assert.equal(entry.displayableRecordCount, 0);
});

test("keeps a CEDIS valid-empty result distinct from unavailable", () => {
  const entry = createCedisSourceHealthEntry("podgorica", {
    freshnessStatus: "fresh",
    lastSuccessfulUpdate: new Date("2026-08-12T09:00:00.000Z"),
    outages: [],
    status: "empty",
  });

  assert.equal(entry.snapshotState, "fresh");
  assert.equal(entry.publicState, "empty");
  assert.equal(entry.displayableRecordCount, 0);
});

test("reports Tivat Flights independently from Podgorica", () => {
  const entry = createFlightsSourceHealthEntry(
    "tivat",
    {
      flights: [
        {
          direction: "arrival",
          location: "Beograd",
          scheduledAt: "2026-08-12T12:30:00.000Z",
          scheduledDate: "2026-08-12",
          scheduledTime: "12:30",
        },
      ],
      lastSuccessfulRefreshAt: "2026-08-12T09:00:00.000Z",
      state: "fresh",
    },
    new Date("2026-08-12T09:00:00.000Z"),
  );

  assert.equal(entry.providerId, "airport-flights");
  assert.equal(entry.cityId, "tivat");
  assert.equal(entry.snapshotState, "fresh");
  assert.equal(entry.displayableRecordCount, 1);
});

test("includes Tivat's configured airport in the assembled read-only health report", async () => {
  const tivat = getCity("tivat");
  assert.ok(tivat);

  const entries = await getSourceHealth(new Date("2026-08-12T09:00:00.000Z"), [tivat]);
  assert.ok(
    entries.some((entry) => entry.providerId === "airport-flights" && entry.cityId === "tivat"),
  );
});
