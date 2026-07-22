import assert from "node:assert/strict";
import test from "node:test";

import {
  getPodgoricaFlightsDisplayState,
  getPodgoricaFlightsUpdatedLabel,
} from "./podgorica-flights-ui-model.ts";

test("distinguishes available, empty, stale, and unavailable flight card states", () => {
  assert.equal(getPodgoricaFlightsDisplayState({ flightCount: 3, state: "fresh" }), "flights");
  assert.equal(getPodgoricaFlightsDisplayState({ flightCount: 3, state: "stale" }), "stale");
  assert.equal(getPodgoricaFlightsDisplayState({ flightCount: 0, state: "fresh" }), "empty");
  assert.equal(
    getPodgoricaFlightsDisplayState({ flightCount: 0, state: "unavailable" }),
    "unavailable",
  );
});

test("uses only the last successful cache refresh for a localized update label", () => {
  const now = new Date("2026-07-22T10:00:00.000Z");

  assert.equal(
    getPodgoricaFlightsUpdatedLabel({
      lastSuccessfulRefreshAt: "2026-07-22T09:52:00.000Z",
      locale: "me",
      now,
    }),
    "Ažurirano prije 8 minuta",
  );
  assert.equal(
    getPodgoricaFlightsUpdatedLabel({
      lastSuccessfulRefreshAt: "2026-07-22T08:00:00.000Z",
      locale: "en",
      now,
    }),
    "Updated 2 hours ago",
  );
  assert.equal(
    getPodgoricaFlightsUpdatedLabel({
      lastSuccessfulRefreshAt: "not-a-date",
      locale: "me",
      now,
    }),
    undefined,
  );
});
