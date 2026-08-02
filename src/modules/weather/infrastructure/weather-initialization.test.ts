import assert from "node:assert/strict";
import test from "node:test";

import { createCityContext } from "@/shared/config/cities";

import { initializeWeatherSnapshots } from "./weather-initialization.ts";

test("startup skips Weather refresh when every active city has a usable snapshot", async () => {
  let refreshes = 0;
  const result = await initializeWeatherSnapshots({
    getContexts: () => [createCityContext("bar"), createCityContext("budva")],
    log: () => undefined,
    readWeather: async () => ({ state: "stale" }),
    refresh: async () => {
      refreshes += 1;
      return [];
    },
  });

  assert.equal(result, "cache-found");
  assert.equal(refreshes, 0);
});

test("startup runs one provider-wide Weather refresh only when a snapshot is unavailable", async () => {
  let refreshes = 0;
  const result = await initializeWeatherSnapshots({
    getContexts: () => [createCityContext("bar"), createCityContext("budva")],
    log: () => undefined,
    readWeather: async (context) => ({
      state: context.city.id === "bar" ? ("unavailable" as const) : ("fresh" as const),
    }),
    refresh: async () => {
      refreshes += 1;
      return [
        {
          cityId: "bar",
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
