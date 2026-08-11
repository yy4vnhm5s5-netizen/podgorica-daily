import assert from "node:assert/strict";
import test from "node:test";

import { createCityContext } from "@/shared/config/cities";

import { initializeParkingAvailability } from "./parking-initialization.ts";

test("starts a non-blocking Parking refresh for a missing or stale snapshot", async () => {
  let refreshes = 0;
  const result = await initializeParkingAvailability({
    getContexts: () => [createCityContext("podgorica")],
    log: () => {},
    readCache: async () => ({ state: "stale" }),
    refresh: async () => {
      refreshes += 1;
      return [
        {
          cityId: "podgorica",
          exitCode: 0,
          output: "",
          refresh: null,
          snapshotState: "fresh",
          state: "success",
        },
      ];
    },
  });

  assert.equal(result, "refreshed");
  assert.equal(refreshes, 1);
});

test("does not refresh when a fresh Parking snapshot is already available", async () => {
  let refreshes = 0;
  const result = await initializeParkingAvailability({
    getContexts: () => [createCityContext("podgorica")],
    log: () => {},
    readCache: async () => ({ state: "fresh" }),
    refresh: async () => {
      refreshes += 1;
      return [];
    },
  });

  assert.equal(result, "cache-found");
  assert.equal(refreshes, 0);
});
