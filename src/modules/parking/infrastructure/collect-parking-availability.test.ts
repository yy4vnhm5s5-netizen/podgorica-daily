import assert from "node:assert/strict";
import test from "node:test";

import { createCityContext, getCity } from "@/shared/config/cities";

import {
  getActiveParkingContexts,
  runActiveParkingCollectors,
  type ParkingCollectorResult,
} from "./collect-parking-availability.ts";

test("selects only active Podgorica when the parking capability is declared", () => {
  assert.deepEqual(
    getActiveParkingContexts().map((context) => context.city.id),
    ["podgorica"],
  );
});

test("does not fetch or create a cache write when Parking is disabled", async () => {
  let calls = 0;
  const results = await runActiveParkingCollectors({
    enabled: false,
    runCollector: async () => {
      calls += 1;
      throw new Error("must not run");
    },
  });

  assert.deepEqual(results, []);
  assert.equal(calls, 0);
});

test("runs the collector once for the approved Podgorica capability", async () => {
  const podgorica = getCity("podgorica");
  assert.ok(podgorica);
  const result: ParkingCollectorResult = {
    cityId: "podgorica",
    exitCode: 0,
    output: "",
    refresh: {
      acceptedLocations: 1,
      retainedPreviousSnapshot: false,
      snapshot: null,
      success: true,
      warnings: [],
    },
    snapshotState: "fresh",
    state: "success",
  };

  const results = await runActiveParkingCollectors({
    cities: [podgorica],
    enabled: true,
    runCollector: async (context) => {
      assert.equal(context.city.id, createCityContext("podgorica").city.id);
      return result;
    },
  });

  assert.deepEqual(results, [result]);
});
