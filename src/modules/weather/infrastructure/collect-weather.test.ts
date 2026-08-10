import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createCityContext, getActiveCities } from "@/shared/config/cities";

import {
  getActiveWeatherContexts,
  runActiveWeatherCollectors,
  runWeatherCollector,
  weatherRefreshConcurrency,
} from "./collect-weather.ts";
import { refreshWeather } from "./weather-refresh.ts";
import { readWeatherCache } from "./weather-cache.ts";

const weather = {
  apparent_temperature: 28.1,
  relative_humidity_2m: 42,
  temperature_2m: 27.4,
  time: 1_784_709_600,
  weather_code: 1,
  wind_speed_10m: 12.4,
};

test("selects every active Weather-capable city from the shared registry", () => {
  assert.deepEqual(
    getActiveWeatherContexts()
      .map((context) => context.city.id)
      .sort(),
    ["bar", "budva", "kotor", "podgorica", "tivat", "ulcinj"],
  );
});

test("automatically includes a newly active Weather-capable city and excludes inactive or unsupported cities", () => {
  const podgorica = createCityContext("podgorica").city;
  const activeFutureCity = {
    ...podgorica,
    id: "future-weather" as const,
    isActive: true,
    isMain: false,
    latitude: 42.1,
    longitude: 19.1,
    slug: "future-weather",
  };
  const inactive = { ...activeFutureCity, id: "inactive-weather" as const, isActive: false };
  const unsupported = { ...activeFutureCity, capabilities: [], id: "unsupported-weather" as const };
  const calls: string[] = [];

  const contexts = getActiveWeatherContexts(
    [activeFutureCity, inactive, unsupported] as unknown as readonly (typeof podgorica)[],
    (cityId) => {
      calls.push(cityId);
      return createCityContext("podgorica");
    },
  );

  assert.equal(contexts.length, 1);
  assert.deepEqual(calls, ["future-weather"]);
});

test("refreshes the active city batch with bounded concurrency and preserves per-city outcomes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-weather-collector-"));
  const cities = getActiveCities();
  let active = 0;
  let maximumActive = 0;

  try {
    const results = await runActiveWeatherCollectors({
      cities,
      lockDirectory: directory,
      async runCollector(context) {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise<void>((resolve) => setTimeout(resolve, 1));
        active -= 1;
        return {
          cityId: context.city.id,
          exitCode: context.city.id === "kotor" ? 1 : 0,
          output: "",
          refresh: null,
          snapshotState: "not-run",
          state: context.city.id === "kotor" ? "failed" : "success",
        };
      },
    });

    assert.equal(results.length, getActiveWeatherContexts().length);
    assert.equal(results.find((result) => result.cityId === "kotor")?.state, "failed");
    assert.equal(results.filter((result) => result.state === "success").length, results.length - 1);
    assert.ok(maximumActive <= weatherRefreshConcurrency);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("keeps a failed city snapshot while other cities in the same Weather batch refresh successfully", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-weather-isolation-"));
  const bar = createCityContext("bar");
  const budva = createCityContext("budva");
  const budvaCachePath = join(directory, "weather-budva.json");

  try {
    await refreshWeather({
      cachePath: budvaCachePath,
      context: budva,
      httpClient: async () => weather,
    });
    const results = await runActiveWeatherCollectors({
      cities: [bar.city, budva.city],
      lockDirectory: directory,
      runCollector: async (context) => {
        const cachePath = join(directory, `weather-${context.city.id}.json`);
        return runWeatherCollector({
          cachePath,
          context,
          refresh: () =>
            refreshWeather({
              cachePath,
              context,
              httpClient: async () => {
                if (context.city.id === "budva") throw new Error("Open-Meteo unavailable");
                return weather;
              },
            }),
          writeOutput: () => undefined,
        });
      },
    });

    assert.deepEqual(
      results.map(({ cityId, state }) => ({ cityId, state })),
      [
        { cityId: "bar", state: "success" },
        { cityId: "budva", state: "failed" },
      ],
    );
    assert.ok(await readWeatherCache("budva", budvaCachePath));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("reuses one provider-wide lock instead of running a concurrent city batch", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-weather-lock-"));
  const city = createCityContext("bar");
  let beginFirstCollector: (() => void) | undefined;
  let releaseFirstCollector: (() => void) | undefined;
  const firstCollectorStarted = new Promise<void>((resolve) => {
    beginFirstCollector = resolve;
  });
  const firstCollectorReleased = new Promise<void>((resolve) => {
    releaseFirstCollector = resolve;
  });
  let concurrentCollectorCalls = 0;

  try {
    const first = runActiveWeatherCollectors({
      cities: [city.city],
      lockDirectory: directory,
      runCollector: async (context) => {
        beginFirstCollector?.();
        await firstCollectorReleased;
        return {
          cityId: context.city.id,
          exitCode: 0,
          output: "",
          refresh: null,
          snapshotState: "fresh",
          state: "success",
        };
      },
    });
    await firstCollectorStarted;
    await access(join(directory, ".weather-refresh.lock"));

    const concurrent = await runActiveWeatherCollectors({
      cities: [city.city],
      lockDirectory: directory,
      async runCollector(context) {
        concurrentCollectorCalls += 1;
        return {
          cityId: context.city.id,
          exitCode: 1,
          output: "",
          refresh: null,
          snapshotState: "unavailable",
          state: "failed",
        };
      },
    });
    assert.deepEqual(
      concurrent.map(({ state }) => state),
      ["already-running"],
    );
    assert.equal(concurrentCollectorCalls, 0);

    releaseFirstCollector?.();
    assert.deepEqual(
      (await first).map(({ state }) => state),
      ["success"],
    );
  } finally {
    releaseFirstCollector?.();
    await rm(directory, { force: true, recursive: true });
  }
});
