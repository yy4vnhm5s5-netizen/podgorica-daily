import assert from "node:assert/strict";
import test from "node:test";

import { getCityServiceFreshnessLabel } from "./city-service-freshness.ts";

const now = new Date("2026-07-19T12:00:00.000Z");
const translations = {
  lastAvailableUpdate: "Posljednje dostupno ažuriranje:",
  updated: "Ažurirano",
};

test("shows a fresh provider update using its last successful snapshot timestamp", () => {
  assert.equal(
    getCityServiceFreshnessLabel({
      freshnessStatus: "fresh",
      lastSuccessfulUpdate: new Date("2026-07-19T11:52:00.000Z"),
      locale: "me",
      now,
      translations,
    }),
    "Ažurirano prije 8 minuta",
  );
});

test("shows retained stale data using the last successful timestamp", () => {
  assert.equal(
    getCityServiceFreshnessLabel({
      freshnessStatus: "stale",
      lastSuccessfulUpdate: new Date("2026-07-19T09:00:00.000Z"),
      locale: "me",
      now,
      translations,
    }),
    "Posljednje dostupno ažuriranje: prije 3 sata",
  );
});

test("does not manufacture an update time for unavailable data", () => {
  assert.equal(
    getCityServiceFreshnessLabel({
      freshnessStatus: "unavailable",
      locale: "me",
      now,
      translations,
    }),
    undefined,
  );
});
