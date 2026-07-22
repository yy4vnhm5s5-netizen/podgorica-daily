import assert from "node:assert/strict";
import test from "node:test";

import {
  toCityAlertRefreshEndpointResult,
  toEventRefreshEndpointResult,
  toFlightsRefreshEndpointResult,
} from "./provider-refresh-result.ts";

test("maps fixed-provider refresh outcomes without exposing cache paths", () => {
  const cedis = toCityAlertRefreshEndpointResult("cedis", {
    exitCode: 0,
    summary: {
      alertCount: 3,
      cachePath: "/private/runtime/cedis.json",
      cacheStatus: "fresh",
      completedAt: "2026-07-22T10:00:00.000Z",
      retainedPreviousSnapshot: false,
      status: "success",
      warnings: [],
    },
  });
  const retainedFlights = toFlightsRefreshEndpointResult({
    exitCode: 1,
    output: "provider=podgorica-airport state=failed cache=retained",
    refresh: {
      acceptedFlights: 4,
      errorCode: "podgorica-flights-request-failed",
      retainedPreviousSnapshot: true,
      snapshot: null,
      success: false,
      warnings: ["upstream unavailable"],
    },
    state: "failed",
  });

  assert.deepEqual(cedis, {
    acceptedCount: 3,
    provider: "cedis",
    retainedPreviousSnapshot: false,
    state: "success",
    warnings: [],
  });
  assert.equal(retainedFlights.state, "retained");
  assert.equal(retainedFlights.acceptedCount, 4);
  assert.equal(JSON.stringify(cedis).includes("/private/"), false);
});

test("keeps Cineplexx out of the standard-events endpoint result", () => {
  const result = toEventRefreshEndpointResult("standard-events", {
    completedAt: "2026-07-22T10:01:00.000Z",
    providers: [
      {
        acceptedCount: 2,
        durationMs: 10,
        id: "kic",
        retainedPreviousSnapshot: false,
        state: "success",
      },
      {
        acceptedCount: 1,
        durationMs: 12,
        id: "tourism-podgorica",
        retainedPreviousSnapshot: true,
        state: "retained",
      },
    ],
    startedAt: "2026-07-22T10:00:00.000Z",
    state: "success",
  });

  assert.equal(result.providerGroup, "standard-events");
  assert.equal(
    result.providers.some(({ id }) => id === "cineplexx-podgorica"),
    false,
  );
  assert.equal(result.state, "retained");
});
