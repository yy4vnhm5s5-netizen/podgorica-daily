import assert from "node:assert/strict";
import test from "node:test";

import {
  toCityAlertRefreshEndpointResult,
  toEventRefreshEndpointResult,
  toFlightsRefreshEndpointResult,
  toMultiCityAlertRefreshEndpointResult,
  toMultiCitySeaWaterQualityRefreshEndpointResult,
  toSeaWaterQualityRefreshEndpointResult,
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

test("includes the safe city identifier for a city-aware CEDIS refresh", () => {
  const result = toCityAlertRefreshEndpointResult("cedis", {
    exitCode: 0,
    summary: {
      alertCount: 1,
      cachePath: "/private/runtime/cedis-budva.json",
      cacheStatus: "fresh",
      cityId: "budva",
      completedAt: "2026-07-22T10:00:00.000Z",
      retainedPreviousSnapshot: false,
      status: "success",
      warnings: [],
    },
  });

  assert.equal(result.cityId, "budva");
  assert.equal(JSON.stringify(result).includes("/private/"), false);
});

test("maps the fixed CEDIS endpoint to every active city result without cache paths", () => {
  const result = toMultiCityAlertRefreshEndpointResult("cedis", [
    {
      exitCode: 0,
      summary: {
        alertCount: 2,
        cachePath: "/private/runtime/cedis-podgorica.json",
        cacheStatus: "fresh",
        cityId: "podgorica",
        completedAt: "2026-07-22T10:00:00.000Z",
        retainedPreviousSnapshot: false,
        status: "success",
        warnings: [],
      },
    },
    {
      exitCode: 0,
      summary: {
        alertCount: 1,
        cachePath: "/private/runtime/cedis-budva.json",
        cacheStatus: "stale",
        cityId: "budva",
        completedAt: "2026-07-22T10:00:00.000Z",
        retainedPreviousSnapshot: true,
        status: "retained",
        warnings: [],
      },
    },
  ]);

  assert.equal(result.state, "retained");
  assert.deepEqual(
    result.cities.map(({ cityId }) => cityId),
    ["podgorica", "budva"],
  );
  assert.equal(JSON.stringify(result).includes("/private/"), false);
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

test("maps a multi-city sea water quality refresh to per-city results without exposing cache paths", () => {
  const result = toMultiCitySeaWaterQualityRefreshEndpointResult([
    {
      cityId: "budva",
      exitCode: 0,
      output: "provider=sea-water-quality city=budva state=success",
      refresh: {
        retainedPreviousSnapshot: false,
        snapshot: null,
        success: true,
        totalLocations: 34,
        warnings: [],
      },
      state: "success",
    },
    {
      cityId: "tivat",
      exitCode: 1,
      output: "provider=sea-water-quality city=tivat state=failed",
      refresh: {
        errorCode: "sea-water-quality-calendar-unrecognized",
        retainedPreviousSnapshot: true,
        snapshot: null,
        success: false,
        totalLocations: 10,
        warnings: [],
      },
      state: "failed",
    },
  ]);

  assert.equal(result.provider, "sea-water-quality");
  assert.deepEqual(
    result.cities.map(({ cityId }) => cityId),
    ["budva", "tivat"],
  );
  assert.equal(result.cities[0]?.acceptedCount, 34);
  assert.equal(result.cities[1]?.state, "retained");
  assert.equal(result.state, "retained");
  assert.equal(JSON.stringify(result).includes("/private/"), false);
});

test("maps a single sea water quality collector result with its city id", () => {
  const result = toSeaWaterQualityRefreshEndpointResult({
    cityId: "tivat",
    exitCode: 0,
    output: "provider=sea-water-quality city=tivat state=success",
    refresh: {
      retainedPreviousSnapshot: false,
      snapshot: null,
      success: true,
      totalLocations: 10,
      warnings: [],
    },
    state: "success",
  });

  assert.equal(result.cityId, "tivat");
  assert.equal(result.acceptedCount, 10);
  assert.equal(result.provider, "sea-water-quality");
  assert.equal(result.state, "success");
});
