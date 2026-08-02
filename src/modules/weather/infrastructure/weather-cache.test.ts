import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createCityContext } from "@/shared/config/cities";

import {
  getCachedCurrentWeather,
  getWeatherCachePath,
  weatherSourceUrl,
  writeWeatherCache,
  type WeatherCacheSnapshot,
} from "./weather-cache.ts";

const context = createCityContext("podgorica");

function createSnapshot(fetchedAt: string): WeatherCacheSnapshot {
  return {
    cityId: "podgorica",
    fetchedAt,
    lastSuccessfulRefreshAt: fetchedAt,
    provider: "open-meteo",
    schemaVersion: 1,
    sourceUrl: weatherSourceUrl,
    weather: {
      apparentTemperature: 28,
      condition: "clearSky",
      humidity: 44,
      temperature: 27,
      updatedAt: fetchedAt,
      windSpeed: 8,
    },
  };
}

test("reads fresh and short-lived stale Weather snapshots while rejecting too-old snapshots", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-weather-cache-"));
  const cachePath = join(directory, "weather-podgorica.json");
  const now = new Date("2026-08-02T10:00:00.000Z");

  try {
    await writeWeatherCache(createSnapshot("2026-08-02T09:50:00.000Z"), cachePath);
    assert.equal((await getCachedCurrentWeather(context, { cachePath, now })).state, "fresh");

    await writeWeatherCache(createSnapshot("2026-08-02T09:40:00.000Z"), cachePath);
    assert.equal((await getCachedCurrentWeather(context, { cachePath, now })).state, "stale");

    await writeWeatherCache(createSnapshot("2026-08-02T09:20:00.000Z"), cachePath);
    assert.deepEqual(await getCachedCurrentWeather(context, { cachePath, now }), {
      state: "unavailable",
    });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("rejects malformed or city-mismatched Weather snapshots safely", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradom-weather-cache-invalid-"));
  const cachePath = join(directory, "weather-podgorica.json");

  try {
    await writeFile(cachePath, JSON.stringify({ cityId: "budva", schemaVersion: 1 }), "utf8");
    assert.deepEqual(await getCachedCurrentWeather(context, { cachePath }), {
      state: "unavailable",
    });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("uses isolated default snapshot paths for every city", () => {
  assert.match(getWeatherCachePath("podgorica"), /weather-podgorica\.json$/u);
  assert.match(getWeatherCachePath("bar"), /weather-bar\.json$/u);
  assert.match(getWeatherCachePath("budva"), /weather-budva\.json$/u);
  assert.match(getWeatherCachePath("kotor"), /weather-kotor\.json$/u);
  assert.match(getWeatherCachePath("tivat"), /weather-tivat\.json$/u);
});
